import type { NextApiRequest, NextApiResponse } from 'next';
import { getChannels, loadVodCache, getVodCache } from '@/utils/db';
import { getChannelVideos } from '@/utils/ytdlp';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your security key.' });
  }

  try {
    const channels = await getChannels();

    const protocol = req.headers['x-forwarded-proto'] || 'http';
    const host = req.headers.host || 'localhost:3000';
    const baseUrl = `${protocol}://${host}`;

    const adminPassword = process.env.ADMIN_PASSWORD;
    const queryKey = req.query.key as string;
    const hasValidKey = adminPassword && queryKey === adminPassword;
    const keyParam = hasValidKey ? `?key=${encodeURIComponent(queryKey)}` : '';
    const keyParamAmp = hasValidKey ? `&key=${encodeURIComponent(queryKey)}` : '';

    // Preload VOD cache for VOD channels
    const vodChannels = channels.filter(c => c.type === 'vod' && (c.id.startsWith('UC') || c.id.startsWith('@')));
    if (vodChannels.length > 0) {
      await loadVodCache();
    }

    let m3uContent = `#EXTM3U x-tvg-url="${baseUrl}/api/epg${keyParam}"\n`;

    for (const channel of channels) {
      if (channel.type === 'vod') {
        const channelId = channel.vodChannelId || channel.id;
        const isIndividualVideo = !channelId.startsWith('UC') && !channelId.startsWith('@');

        if (isIndividualVideo) {
          // Individual VOD entry (vodLimit=1, single video ID)
          const tvgId = channel.id;
          const tvgName = channel.name.replace(/"/g, "'");
          const tvgLogo = channel.logoUrl || '';
          const groupTitle = channel.category.replace(/"/g, "'") || 'General';
          const playUrl = `${baseUrl}/api/play?id=${channel.id}${keyParamAmp}&ext=.mp4`;

          m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${groupTitle}",${channel.name}\n`;
          m3uContent += `${playUrl}\n`;
        } else {
          // Multi-entry VOD channel — fetch from cache or scan
          let videos = getVodCache()[channel.id]?.entries || [];
          if (videos.length === 0) {
            try {
              const limit = Math.max(channel.vodLimit || 10, 20);
              videos = await getChannelVideos(channelId, limit);
            } catch {
              videos = [];
            }
          }

          const limit = channel.vodLimit || 10;
          const keyword = channel.vodKeyword || '';
          let filtered = videos;
          if (keyword) {
            const lowerKw = keyword.toLowerCase();
            filtered = videos.filter(v => v.title && v.title.toLowerCase().includes(lowerKw));
          }
          filtered = filtered.slice(0, limit);

          for (const video of filtered) {
            const tvgId = video.id;
            const tvgName = video.title.replace(/"/g, "'");
            const tvgLogo = video.thumbnail || '';
            const groupTitle = channel.category.replace(/"/g, "'") || 'General';
            const playUrl = `${baseUrl}/api/play?id=${video.id}${keyParamAmp}&ext=.mp4`;

            m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${groupTitle}",${video.title}\n`;
            m3uContent += `${playUrl}\n`;
          }
        }
      } else {
        const tvgId = channel.id;
        const tvgName = channel.name.replace(/"/g, "'");
        const tvgLogo = channel.logoUrl || '';
        const groupTitle = channel.category.replace(/"/g, "'") || 'General';

        const isLive = channel.type === 'live';
        const ext = isLive ? '&ext=.m3u8' : '&ext=.mp4';
        const playUrl = `${baseUrl}/api/play?id=${channel.id}${keyParamAmp}${ext}`;

        m3uContent += `#EXTINF:-1 tvg-id="${tvgId}" tvg-name="${tvgName}" tvg-logo="${tvgLogo}" group-title="${groupTitle}",${channel.name}\n`;
        m3uContent += `${playUrl}\n`;
      }
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
