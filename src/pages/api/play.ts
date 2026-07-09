import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveStreamUrl, findLiveStreamByKeyword, getChannelVideos, searchChannelVideos } from '@/utils/ytdlp';
import { getChannels, loadVodCache } from '@/utils/db';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your security key.' });
  }

  const { id, url, refresh, q } = req.query;

  if (!id && !url) {
    return res.status(400).json({ error: 'Missing parameters. Provide "id" or "url".' });
  }

  let targetUrl = '';
  if (url) {
    targetUrl = decodeURIComponent(url as string);
  } else {
    const idStr = id as string;
    const searchKeyword = q as string;

    if ((idStr.startsWith('UC') || idStr.startsWith('@')) && searchKeyword) {
      // If a channel handle/ID and a search keyword is provided, search the active streams list
      const matchedVideoId = await findLiveStreamByKeyword(idStr, searchKeyword);
      if (matchedVideoId) {
        targetUrl = `https://www.youtube.com/watch?v=${matchedVideoId}`;
      } else {
        targetUrl = `https://www.youtube.com/${idStr.startsWith('@') ? '' : 'channel/'}${idStr}/live`;
      }
    } else if (idStr.startsWith('UC') || idStr.startsWith('@')) {
      // Check if this is a VOD channel
      const channels = await getChannels();
      const channel = channels.find(c => c.id === idStr && c.type === 'vod');
      if (channel) {
        await loadVodCache();
        const keyword = channel.vodKeyword || searchKeyword;
        let videos;
        if (keyword) {
          videos = await searchChannelVideos(idStr, keyword);
        } else {
          videos = await getChannelVideos(idStr, channel.vodLimit || 10);
        }
        if (videos && videos.length > 0) {
          targetUrl = `https://www.youtube.com/watch?v=${videos[0].id}`;
        } else {
          return res.status(404).json({ error: 'No videos found for this VOD channel.' });
        }
      } else {
        targetUrl = `https://www.youtube.com/${idStr.startsWith('@') ? '' : 'channel/'}${idStr}/live`;
      }
    } else {
      // Standard YouTube Video ID (works for both video and individual VOD entries)
      targetUrl = `https://www.youtube.com/watch?v=${idStr}`;
    }
  }

  try {
    const forceRefresh = refresh === 'true';
    const streamUrl = await resolveStreamUrl(targetUrl, forceRefresh);

    // Check if this is an HLS playlist URL — needs server-side proxy for auth/cookies/geo
    const isHlsPlaylist = streamUrl.includes('playlist') || streamUrl.endsWith('.m3u8') || streamUrl.endsWith('.m3u');

    if (isHlsPlaylist) {
      // Proxy the HLS playlist through the server (the Google URL was generated with
      // Render's IP and YouTube cookies — VLC may not have access from its IP)
      try {
        const playlistResponse = await fetch(streamUrl);
        const content = await playlistResponse.text();

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Content-Disposition', 'inline');
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
        res.setHeader('Access-Control-Allow-Origin', '*');

        return res.status(200).send(content);
      } catch (proxyError: any) {
        console.error('Playlist proxy failed, falling back to redirect:', proxyError.message);
        res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
        res.setHeader('Pragma', 'no-cache');
        res.setHeader('Expires', '0');
        return res.redirect(302, streamUrl);
      }
    } else {
      // Direct media URL (mp4, ts, etc.) — use redirect (no cookie/auth needed)
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      return res.redirect(302, streamUrl);
    }
  } catch (error: any) {
    console.error('Playback resolution failed:', error);
    return res.status(500).json({ 
      error: 'Failed to resolve stream URL. The video might be private, region-locked, or offline.', 
      details: error.message 
    });
  }
}
