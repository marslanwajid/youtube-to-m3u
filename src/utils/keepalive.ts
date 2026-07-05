/**
 * Keep-Alive Self-Pinger for Render.com free tier.
 * It pings the app's own external URL every 10 minutes to prevent the container from sleeping.
 */
let isKeepAliveStarted = false;

export function initKeepAlive() {
  if (isKeepAliveStarted) return;

  const isRender = process.env.RENDER === 'true';
  const externalUrl = process.env.RENDER_EXTERNAL_URL;

  if (!isRender || !externalUrl) {
    console.log('[Keep-Alive] Not running on Render or RENDER_EXTERNAL_URL is not set. Skipping self-ping.');
    return;
  }

  isKeepAliveStarted = true;
  const pingUrl = `${externalUrl.replace(/\/$/, '')}/api/hello`;

  console.log(`[Keep-Alive] Initializing self-ping loop for: ${pingUrl}`);

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
