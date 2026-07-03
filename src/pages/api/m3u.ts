import type { NextApiRequest, NextApiResponse } from 'next';
import { getChannels } from '@/utils/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const channels = await getChannels();

    // Determine current protocol and host
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    let m3uContent = `#EXTM3U x-tvg-url="${baseUrl}/api/epg"\n`;

    for (const channel of channels) {
      // Map properties for IPTV tags
      const tvgId = channel.id;
      const tvgName = channel.name.replace(/"/g, "'"); // Escape quotes
      const tvgLogo = channel.logoUrl || '';
      const groupTitle = channel.category.replace(/"/g, "'") || 'General';
      const playUrl = `${baseUrl}/api/play?id=${channel.id}`;

      m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${groupTitle}",${channel.name}\n`;
      m3uContent += `${playUrl}\n`;
    }

    res.setHeader('Content-Type', 'application/x-mpegurl');
    res.setHeader('Content-Disposition', 'attachment; filename="youtube_channels.m3u"');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');

    return res.status(200).send(m3uContent);
  } catch (error: any) {
    console.error('Failed to generate M3U playlist:', error);
    return res.status(500).json({ error: 'Failed to generate M3U playlist', details: error.message });
  }
}
