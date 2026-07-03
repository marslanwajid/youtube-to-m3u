import type { NextApiRequest, NextApiResponse } from 'next';
import { getChannelLiveStreams } from '@/utils/ytdlp';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please check your security key.' });
  }

  const { url } = req.query;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({ error: 'Missing channel URL parameter.' });
  }

  try {
    // Extract channel handle or ID from URL
    // e.g. youtube.com/@Handle or youtube.com/channel/UC...
    const handleMatch = url.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)/i);
    let channelIdOrHandle = handleMatch ? handleMatch[1] : '';

    if (url.includes('/@') && channelIdOrHandle && !channelIdOrHandle.startsWith('@')) {
      channelIdOrHandle = `@${channelIdOrHandle}`;
    }

    if (!channelIdOrHandle) {
      return res.status(400).json({ error: 'Invalid YouTube channel URL. Must contain a channel handle (@) or ID (UC).' });
    }

    const streams = await getChannelLiveStreams(channelIdOrHandle);
    return res.status(200).json(streams);
  } catch (error: any) {
    console.error('Failed to retrieve channel live streams:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve live streams list. Make sure the channel is public.', 
      details: error.message 
    });
  }
}
