import type { NextApiRequest, NextApiResponse } from "next";
import { prefetchAllChannels } from '@/utils/ytdlp';

type Data = {
  name: string;
  prefetchStarted: boolean;
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  // Prevent edge CDNs and browsers from caching this route so pingers always hit the origin
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Trigger background cache warming
  prefetchAllChannels().catch(err => {
    console.error('Error running prefetch from hello ping:', err);
  });

  res.status(200).json({ name: "John Doe", prefetchStarted: true });
}

