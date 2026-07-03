import type { NextApiRequest, NextApiResponse } from 'next';
import { resolveStreamUrl } from '@/utils/ytdlp';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { id, url, refresh } = req.query;

  if (!id && !url) {
    return res.status(400).json({ error: 'Missing parameters. Provide "id" or "url".' });
  }

  let targetUrl = '';
  if (url) {
    targetUrl = decodeURIComponent(url as string);
  } else {
    const idStr = id as string;
    // Determine target YouTube URL based on ID structure
    if (idStr.startsWith('UC') || idStr.startsWith('@')) {
      // YouTube Channel ID or Custom Handle live stream
      targetUrl = `https://www.youtube.com/${idStr.startsWith('@') ? '' : 'channel/'}${idStr}/live`;
    } else {
      // Standard YouTube Video ID
      targetUrl = `https://www.youtube.com/watch?v=${idStr}`;
    }
  }

  try {
    const forceRefresh = refresh === 'true';
    const streamUrl = await resolveStreamUrl(targetUrl, forceRefresh);
    
    // Disable caching of the 302 redirect itself, as the underlying YouTube links rotate
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    
    return res.redirect(302, streamUrl);
  } catch (error: any) {
    console.error('Playback resolution failed:', error);
    return res.status(500).json({ 
      error: 'Failed to resolve stream URL. The video might be private, region-locked, or offline.', 
      details: error.message 
    });
  }
}
