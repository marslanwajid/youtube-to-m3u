import type { NextApiRequest, NextApiResponse } from 'next';
import { create } from 'xmlbuilder2';
import { getChannels } from '@/utils/db';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your security key.' });
  }

  try {
    const channels = await getChannels();

    // Create XMLTV document
    const root = create({ version: '1.0', encoding: 'UTF-8' })
      .ele('tv', { 'generator-info-name': 'YouTube-to-M3U-Converter' });

    // 1. Add all channel definitions
    for (const channel of channels) {
      const channelEl = root.ele('channel', { id: channel.id });
      channelEl.ele('display-name').txt(channel.name);
      if (channel.logoUrl) {
        channelEl.ele('icon', { src: channel.logoUrl });
      }
    }

    // 2. Add programme listings
    // We will generate 2-hour slots for the past 6 hours and next 18 hours (24 hours total)
    const slotDurationMs = 2 * 60 * 60 * 1000; // 2 hours in ms
    const totalSlots = 12; // 24 hours total
    
    const now = Date.now();
    const startTime = now - (6 * 60 * 60 * 1000);
    // Align start time to the 2-hour boundary
    const alignedStart = Math.floor(startTime / slotDurationMs) * slotDurationMs;

    const formatDate = (date: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const y = date.getUTCFullYear();
      const m = pad(date.getUTCMonth() + 1);
      const d = pad(date.getUTCDate());
      const h = pad(date.getUTCHours());
      const min = pad(date.getUTCMinutes());
      const s = pad(date.getUTCSeconds());
      return `${y}${m}${d}${h}${min}${s} +0000`;
    };

    const mockTitles = [
      'Live Special Broadcast',
      'Daily Non-Stop Stream',
      'Community Choice Marathon',
      'Prime Selection Live',
      'Worldwide Live Broadcast',
      'Interactive Live Stream',
      'Featured Content Special',
      'Chill Vibes Live Session',
      'Morning Energy Stream',
      'Night Owls Continuous Play'
    ];

    const mockDescriptions = [
      'Join us for this special live event broadcasted directly on YouTube. Enjoy high-quality video and engaging content.',
      'A continuous selection of our best content, curated specifically for our viewers. Tune in for non-stop entertainment.',
      'The best moments from our channel, chosen by our community and live streamed back-to-back.',
      'Premium live content highlighting the best programming from our creators.',
      'Broadcasting live across the globe. Stay tuned for real-time updates and entertainment.',
      'Live stream featuring viewer interaction, discussions, and the latest content.',
      'A special presentation of featured videos and highlights from our channel library.',
      'Relax, study, or work with our selection of chill tracks and visuals.',
      'Kickstart your day with our high-energy morning stream.',
      'Late-night streams for our night owl viewers, running continuously through the night.'
    ];

    for (const channel of channels) {
      if (!channel.enableEpg) continue;

      // Hash channel.id to create a unique seed for this channel
      const channelSeed = channel.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);

      for (let i = 0; i < totalSlots; i++) {
        const slotStartMs = alignedStart + (i * slotDurationMs);
        const slotEndMs = slotStartMs + slotDurationMs;

        const start = new Date(slotStartMs);
        const stop = new Date(slotEndMs);

        // Generate pseudo-random but stable index based on channel seed and slot index
        // This ensures the EPG is identical when fetched multiple times within the same slot window
        const slotSeed = channelSeed + i + Math.floor(alignedStart / (24 * 60 * 60 * 1000));
        const titleIndex = Math.abs(slotSeed) % mockTitles.length;
        const descIndex = Math.abs(slotSeed * 17) % mockDescriptions.length;

        const title = `${channel.name} - ${mockTitles[titleIndex]}`;
        const desc = mockDescriptions[descIndex];

        root.ele('programme', {
          start: formatDate(start),
          stop: formatDate(stop),
          channel: channel.id
        })
          .ele('title', { lang: 'en' }).txt(title).up()
          .ele('desc', { lang: 'en' }).txt(desc);
      }
    }

    const xmlString = root.end({ prettyPrint: true });

    res.setHeader('Content-Type', 'application/xml');
    res.setHeader('Content-Disposition', 'attachment; filename="epg.xml"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return res.status(200).send(xmlString);
  } catch (error: any) {
    console.error('Failed to generate EPG:', error);
    return res.status(500).json({ error: 'Failed to generate EPG', details: error.message });
  }
}
