import type { NextApiRequest, NextApiResponse } from 'next';
import { getChannels } from '@/utils/db';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your security key.' });
  }

  try {
    const channels = await getChannels();

    // Determine current protocol and host
    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    // Append key for IPTV player to fetch protected EPG and play routes
    const adminPassword = process.env.ADMIN_PASSWORD;
    const queryKey = req.query.key as string;
    const hasValidKey = adminPassword && queryKey === adminPassword;
    const keyParam = hasValidKey ? `?key=${encodeURIComponent(queryKey)}` : '';
    const keyParamAmp = hasValidKey ? `&key=${encodeURIComponent(queryKey)}` : '';

    let m3uContent = `#EXTM3U x-tvg-url="${baseUrl}/api/epg${keyParam}"\n`;

    for (const channel of channels) {
      // Map properties for IPTV tags
      const tvgId = channel.id;
      const tvgName = channel.name.replace(/"/g, "'"); // Escape quotes
      const tvgLogo = channel.logoUrl || '';
      const groupTitle = channel.category.replace(/"/g, "'") || 'General';
      const playUrl = `${baseUrl}/api/play?id=${channel.id}${keyParamAmp}`;

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
