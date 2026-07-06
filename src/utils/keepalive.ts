import { prefetchAllChannels } from './ytdlp';

/**
 * Keep-Alive Self-Pinger for Render.com free tier.
 * It pings the app's own external URL every 10 minutes to prevent the container from sleeping.
 */
let isKeepAliveStarted = false;

export function initKeepAlive() {
  if (isKeepAliveStarted) return;

  const isRender = process.env.RENDER === 'true';
  const externalUrl = process.env.RENDER_EXTERNAL_URL;

  // Even if not on Render, we can run the startup prefetch to warm the local cache for development!
  if (!isRender || !externalUrl) {
    console.log('[Keep-Alive] Not running on Render or RENDER_EXTERNAL_URL is not set. Running initial prefetch only.');
    setTimeout(() => {
      prefetchAllChannels().catch(err => {
        console.error('[Keep-Alive] Initial prefetch failed:', err);
      });
    }, 10 * 1000);
    return;
  }

  isKeepAliveStarted = true;
  const pingUrl = `${externalUrl.replace(/\/$/, '')}/api/hello`;

  console.log(`[Keep-Alive] Initializing self-ping loop for: ${pingUrl}`);

  // Trigger initial prefetch shortly after boot (10 seconds)
  setTimeout(() => {
    console.log('[Keep-Alive] Triggering initial background prefetch...');
    prefetchAllChannels().catch(err => {
      console.error('[Keep-Alive] Initial prefetch failed:', err);
    });
  }, 10 * 1000);

  // Ping immediately to log connection and then every 10 minutes
  const ping = async () => {
    try {
      console.log(`[Keep-Alive] Pinging self at ${new Date().toISOString()}`);
      const res = await fetch(pingUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) KeepAlive/1.0',
        }
      });
      console.log(`[Keep-Alive] Ping response status: ${res.status}`);
    } catch (e: any) {
      console.error(`[Keep-Alive] Ping failed:`, e.message);
    }
  };

  // Wait 1 minute after start before the first ping to let server boot up completely, then repeat every 10 minutes
  setTimeout(() => {
    ping();
    setInterval(ping, 10 * 60 * 1000);
  }, 60 * 1000);
}

