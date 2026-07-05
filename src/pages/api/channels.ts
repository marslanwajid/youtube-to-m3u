import type { NextApiRequest, NextApiResponse } from 'next';
import { getChannels, addChannel, deleteChannel, updateChannel, Channel } from '@/utils/db';
import { fetchMetadata } from '@/utils/ytdlp';
import { isRequestAuthenticated } from '@/utils/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { method } = req;

  if (!isRequestAuthenticated(req)) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }

  try {
    switch (method) {
      case 'GET': {
        const channels = await getChannels();
        return res.status(200).json(channels);
      }

      case 'POST': {
        const { youtubeUrl, category, name, logoUrl, enableEpg } = req.body;

        if (!youtubeUrl) {
          return res.status(400).json({ error: 'YouTube URL is required' });
        }

        // Auto-extract ID from YouTube URL
        let id = '';
        let type: 'video' | 'live' | 'playlist' = 'video';

        // Match video ID (watch?v= or e/)
        const videoMatch = youtubeUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
        // Match playlist ID (list=)
        const playlistMatch = youtubeUrl.match(/[?&]list=([^#\&\?]+)/i);
        // Match channel URL (with or without /live or /streams)
        const channelLiveMatch = youtubeUrl.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)/i);

        if (playlistMatch) {
          id = playlistMatch[1];
          type = 'playlist';
        } else if (videoMatch) {
          id = videoMatch[1];
          type = 'video';
        } else if (channelLiveMatch) {
          const handleMatch = youtubeUrl.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)/i);
          id = handleMatch ? handleMatch[1] : 'live_channel';
          if (youtubeUrl.includes('/@') && !id.startsWith('@')) {
            id = `@${id}`;
          }
          type = 'live';

          // Extract q=... query parameter if present
          try {
            const urlObj = new URL(youtubeUrl);
            const qParam = urlObj.searchParams.get('q');
            if (qParam) {
              id = `${id}&q=${encodeURIComponent(qParam)}`;
            }
          } catch (e) {
            // Regex fallback if URL parse fails
            const qMatch = youtubeUrl.match(/[?&]q=([^&#]+)/i);
            if (qMatch && qMatch[1]) {
              id = `${id}&q=${qMatch[1]}`;
            }
          }
        } else {
          return res.status(400).json({ error: 'Invalid YouTube URL. Supported formats: watch URLs, playlists, or channel /live links.' });
        }

        let channelName = name || '';
        let channelLogo = logoUrl || '';
        let isLive = type === 'live';

        // Proactively fetch YouTube metadata if title or logo is missing
        if (!channelName || !channelLogo || type === 'video') {
          try {
            const meta = await fetchMetadata(youtubeUrl);
            if (!channelName) channelName = meta.title;
            if (!channelLogo) channelLogo = meta.thumbnail;
            if (meta.isLive) {
              type = 'live'; // Promoted to live if yt-dlp reports it is live
            }
          } catch (e: any) {
            console.warn('Failed to fetch YouTube metadata, using default values:', e.message);
            if (!channelName) {
              channelName = type === 'playlist' ? `Playlist (${id})` : `Channel (${id})`;
            }
          }
        }

        const newChannel = await addChannel({
          id,
          name: channelName,
          type,
          youtubeUrl,
          category: category || 'General',
          logoUrl: channelLogo,
          enableEpg: enableEpg !== false,
        });

        return res.status(201).json(newChannel);
      }

      case 'PUT': {
        const { id, name, category, logoUrl, enableEpg, youtubeUrl } = req.body;

        if (!id) {
          return res.status(400).json({ error: 'Channel ID is required' });
        }

        const updated = await updateChannel(id, {
          name,
          category,
          logoUrl,
          enableEpg,
          youtubeUrl,
        });

        return res.status(200).json(updated);
      }

      case 'DELETE': {
        const { id } = req.query;

        if (!id || typeof id !== 'string') {
          return res.status(400).json({ error: 'Channel ID is required as query parameter' });
        }

        await deleteChannel(id);
        return res.status(200).json({ success: true, message: `Channel ${id} deleted successfully.` });
      }

      default:
        res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
        return res.status(405).end(`Method ${method} Not Allowed`);
    }
  } catch (error: any) {
    console.error('API channels error:', error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
