import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';
import { getChannels, loadStreamCache, saveStreamCache } from './db';

const execPromise = promisify(exec);
const BIN_DIR = path.join(process.cwd(), 'bin');
const BIN_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
const BIN_PATH = path.join(BIN_DIR, BIN_NAME);

let resolvedPath: string | null = null;

export async function getYTDlpPath(): Promise<string> {
  if (resolvedPath) return resolvedPath;

  // 1. Check if yt-dlp is available in the system PATH
  try {
    const checkCmd = process.platform === 'win32' ? 'where yt-dlp' : 'which yt-dlp';
    execSync(checkCmd, { stdio: 'ignore' });
    console.log('Using system-wide yt-dlp');
    resolvedPath = 'yt-dlp';
    return resolvedPath;
  } catch (e) {
    // yt-dlp not in PATH, proceed to check local binary
  }

  // 2. Setup local binary directory
  if (!fs.existsSync(BIN_DIR)) {
    fs.mkdirSync(BIN_DIR, { recursive: true });
  }

  // 3. Download local binary if not exists
  if (!fs.existsSync(BIN_PATH)) {
    console.log('yt-dlp not found in PATH. Downloading local binary to:', BIN_PATH);
    try {
      await YTDlpWrap.downloadFromGithub(BIN_PATH);
      if (process.platform !== 'win32') {
        fs.chmodSync(BIN_PATH, '755'); // Make it executable
      }
      console.log('yt-dlp local binary downloaded successfully.');
    } catch (err) {
      console.error('Failed to download yt-dlp from GitHub:', err);
      throw new Error('yt-dlp binary is missing and could not be downloaded.');
    }
  }

  resolvedPath = BIN_PATH;
  return resolvedPath;
}

// Cache for resolved stream URLs to avoid rate limits and speed up playback
// Key: videoId or URL, Value: { url: string, expires: number }
export interface CacheEntry {
  url: string;
  expires: number;
}
const streamCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 1 * 60 * 60 * 1000; // Fallback: 1 hour in milliseconds

let isCacheLoaded = false;
async function ensureCacheLoaded() {
  if (isCacheLoaded) return;
  isCacheLoaded = true;
  try {
    const loaded = await loadStreamCache();
    if (loaded) {
      Object.assign(streamCache, loaded);
      console.log(`[Cache] Loaded ${Object.keys(streamCache).length} stream entries from persistence`);
    }
  } catch (err: any) {
    console.error('[Cache] Error loading persisted cache:', err.message);
  }
}

function normalizeNetscapeCookies(rawCookies: string): string {
  // Replace literal '\n' sequences with real newlines in case it was escaped in env variables
  const normalized = rawCookies.replace(/\\n/g, '\n');
  const lines = normalized.split(/\r?\n/);
  const result: string[] = [
    '# Netscape HTTP Cookie File',
    '# http://curl.haxx.se/rfc/cookie_spec.html',
    '# This is a generated file! Do not edit.',
    ''
  ];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    // Split by spaces or tabs
    const parts = trimmed.split(/\s+/);
    if (parts.length >= 7) {
      const domain = parts[0];
      const flag = parts[1];
      const path = parts[2];
      const secure = parts[3];
      const expiration = parts[4];
      const name = parts[5];
      const value = parts.slice(6).join(' ');
      result.push([domain, flag, path, secure, expiration, name, value].join('\t'));
    }
  }
  return result.join('\n');
}

function getCommonFlags(): string {
  let flags = '--remote-components ejs:github --js-runtimes node';

  // Match the user-agent of the browser that generated the cookies to prevent YouTube from detecting a mismatch
  const userAgent = process.env.YOUTUBE_USER_AGENT || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36';
  flags += ` --user-agent "${userAgent}"`;

  const cookiesEnv = process.env.YOUTUBE_COOKIES;
  if (cookiesEnv) {
    const cookiesPath = process.platform === 'win32'
      ? path.join(process.cwd(), 'data', 'cookies.txt')
      : '/tmp/cookies.txt';

    try {
      const dir = path.dirname(cookiesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const formattedCookies = normalizeNetscapeCookies(cookiesEnv);
      fs.writeFileSync(cookiesPath, formattedCookies, 'utf8');
      flags += ` --cookies "${cookiesPath}"`;
      console.log('Using custom formatted YouTube cookies for authentication');
    } catch (e: any) {
      console.error('Failed to write cookies file:', e.message);
    }
  }

  const proxy = process.env.YOUTUBE_PROXY;
  if (proxy) {
    flags += ` --proxy "${proxy}"`;
  }

  return flags;
}

/**
 * Resolves a YouTube URL to its raw direct media stream URL (M3U8).
 * Utilizes caching to speed up subsequent requests.
 */
export async function resolveStreamUrl(url: string, forceRefresh = false): Promise<string> {
  await ensureCacheLoaded();
  const now = Date.now();
  if (!forceRefresh && streamCache[url] && streamCache[url].expires > now) {
    console.log('Stream URL resolved from cache:', url);
    return streamCache[url].url;
  }

  const binaryPath = await getYTDlpPath();
  console.log(`Resolving stream URL for: ${url} using ${binaryPath}`);

  // -f best[ext=mp4]/best gets the highest quality pre-merged stream (video + audio combined)
  const cmd = `"${binaryPath}" ${getCommonFlags()} -f "best[ext=mp4]/best" -g "${url}"`;
  
  try {
    const { stdout } = await execPromise(cmd);
    const resolvedUrls = stdout.trim().split('\n');
    // If it returns multiple URLs, the last one or first one might be what we need.
    // For HLS streams (live), it usually outputs a single .m3u8 link.
    const resolvedUrl = resolvedUrls[0]?.trim();
    
    if (!resolvedUrl) {
      throw new Error('No stream URL returned by yt-dlp');
    }

    // Parse Google Video URL expiration timestamp (if present)
    let expires = now + CACHE_DURATION;
    const expireMatch = resolvedUrl.match(/[\/\?&]expire[\/=](\d+)/);
    if (expireMatch && expireMatch[1]) {
      const expireEpochSeconds = parseInt(expireMatch[1], 10);
      // Set cache expiration to 15 minutes before the URL actually expires to be safe
      const safetyMargin = 15 * 60 * 1000;
      const parsedExpires = (expireEpochSeconds * 1000) - safetyMargin;
      if (parsedExpires > now) {
        expires = parsedExpires;
      }
    }

    // Cache the resolved URL
    streamCache[url] = {
      url: resolvedUrl,
      expires,
    };

    // Save cache asynchronously in background
    saveStreamCache(streamCache).catch(err => {
      console.error('[Cache] Error saving stream cache:', err.message);
    });

    return resolvedUrl;
  } catch (error: any) {
    console.error(`Error resolving stream URL for ${url}:`, error.message);
    throw error;
  }
}

export interface YouTubeMetadata {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  duration?: number;
  channel?: string;
  channelId?: string;
  isLive?: boolean;
  entries?: Array<{ id: string; title: string; duration?: number }>;
}

/**
 * Fetches metadata for a video, playlist, or channel.
 */
export async function fetchMetadata(url: string): Promise<YouTubeMetadata> {
  const binaryPath = await getYTDlpPath();
  
  // Format commands based on playlist or single item.
  // We use flat-playlist and dump-single-json to keep the query fast.
  const cmd = `"${binaryPath}" ${getCommonFlags()} --flat-playlist --dump-single-json "${url}"`;
  
  try {
    const { stdout } = await execPromise(cmd);
    const data = JSON.parse(stdout);
    
    const isPlaylist = Array.isArray(data.entries);
    
    if (isPlaylist) {
      return {
        id: data.id || '',
        title: data.title || 'YouTube Playlist',
        description: data.description || '',
        thumbnail: data.thumbnails?.[0]?.url || data.thumbnail || '',
        channel: data.uploader || data.channel || '',
        channelId: data.channel_id || '',
        entries: data.entries.map((entry: any) => ({
          id: entry.id,
          title: entry.title,
          duration: entry.duration,
        })),
      };
    } else {
      return {
        id: data.id || '',
        title: data.title || 'YouTube Video',
        description: data.description || '',
        thumbnail: data.thumbnail || data.thumbnails?.[0]?.url || '',
        duration: data.duration,
        channel: data.uploader || data.channel || '',
        channelId: data.channel_id || '',
        isLive: data.is_live || false,
      };
    }
  } catch (error: any) {
    console.error(`Error fetching metadata for ${url}:`, error.message);
    throw error;
  }
}

export interface ActiveLiveStream {
  id: string;
  title: string;
  thumbnail: string;
  url: string;
}

/**
 * Fetches all currently active streams for a channel.
 */
export async function getChannelLiveStreams(channelIdOrHandle: string): Promise<ActiveLiveStream[]> {
  const binaryPath = await getYTDlpPath();
  const channelPath = channelIdOrHandle.startsWith('@') ? channelIdOrHandle : `channel/${channelIdOrHandle}`;
  const streamsUrl = `https://www.youtube.com/${channelPath}/streams`;

  console.log(`Fetching active live streams list for channel: ${streamsUrl}`);

  const cmd = `"${binaryPath}" ${getCommonFlags()} --flat-playlist --dump-single-json "${streamsUrl}"`;

  try {
    const { stdout } = await execPromise(cmd);
    const data = JSON.parse(stdout);

    if (data && Array.isArray(data.entries)) {
      const activeEntries = data.entries.filter((entry: any) => entry.duration === null || entry.duration === undefined);
      
      return activeEntries.map((entry: any) => {
        const thumbnail = entry.thumbnails?.[entry.thumbnails.length - 1]?.url 
          || entry.thumbnail 
          || `https://i.ytimg.com/vi/${entry.id}/hqdefault.jpg`;
          
        return {
          id: entry.id || '',
          title: entry.title || 'YouTube Live Stream',
          thumbnail,
          url: entry.url || `https://www.youtube.com/watch?v=${entry.id}`,
        };
      });
    }
    return [];
  } catch (error: any) {
    console.error(`Failed to fetch channel live streams for ${channelIdOrHandle}:`, error.message);
    throw error;
  }
}

/**
 * Searches a channel's active streams tab for a stream matching a title keyword.
 * Returns the matching video ID, or null if no match is found.
 */
export async function findLiveStreamByKeyword(channelIdOrHandle: string, keyword: string): Promise<string | null> {
  try {
    const entries = await getChannelLiveStreams(channelIdOrHandle);
    const lowerKeyword = keyword.toLowerCase();
    
    // Look for the first entry matching the keyword in the title
    const match = entries.find((entry: ActiveLiveStream) => 
      entry.title && entry.title.toLowerCase().includes(lowerKeyword)
    );
    
    if (match && match.id) {
      console.log(`Found matching live stream ID: ${match.id} for keyword: "${keyword}"`);
      return match.id;
    }
    return null;
  } catch (error: any) {
    console.error(`Error searching channel streams for keyword "${keyword}":`, error.message);
    return null;
  }
}

let isPrefetching = false;

/**
 * Periodically refreshes all channel stream URLs in the background.
 */
export async function prefetchAllChannels() {
  if (isPrefetching) {
    console.log('[Prefetch] Prefetch already in progress. Skipping.');
    return;
  }
  isPrefetching = true;
  console.log('[Prefetch] Starting background prefetch of all channels...');

  try {
    await ensureCacheLoaded();
    const channels = await getChannels();
    const now = Date.now();
    const safetyMargin = 15 * 60 * 1000; // Refresh if expiring in less than 15 mins

    for (const channel of channels) {
      if (channel.type === 'playlist') {
        continue;
      }

      let targetUrl = '';
      const idStr = channel.id;

      let parsedId = idStr;
      let searchKeyword = '';
      if (idStr.includes('&q=')) {
        const parts = idStr.split('&q=');
        parsedId = parts[0];
        searchKeyword = decodeURIComponent(parts[1]);
      }

      if ((parsedId.startsWith('UC') || parsedId.startsWith('@')) && searchKeyword) {
        const matchedVideoId = await findLiveStreamByKeyword(parsedId, searchKeyword);
        if (matchedVideoId) {
          targetUrl = `https://www.youtube.com/watch?v=${matchedVideoId}`;
        } else {
          targetUrl = `https://www.youtube.com/${parsedId.startsWith('@') ? '' : 'channel/'}${parsedId}/live`;
        }
      } else if (parsedId.startsWith('UC') || parsedId.startsWith('@')) {
        targetUrl = `https://www.youtube.com/${parsedId.startsWith('@') ? '' : 'channel/'}${parsedId}/live`;
      } else {
        targetUrl = `https://www.youtube.com/watch?v=${parsedId}`;
      }

      const cacheEntry = streamCache[targetUrl];
      const isExpiringSoon = cacheEntry && (cacheEntry.expires - now < safetyMargin);

      if (!cacheEntry || isExpiringSoon) {
        console.log(`[Prefetch] Resolving stream for: ${channel.name} (${targetUrl})`);
        try {
          // Resolve with forceRefresh to bypass cache and fetch new URL
          await resolveStreamUrl(targetUrl, true);
          // Wait 2 seconds to avoid overwhelming Render CPU / YouTube rate limits
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (err: any) {
          console.error(`[Prefetch] Failed to resolve stream for ${channel.name}:`, err.message);
        }
      } else {
        const minutesLeft = Math.round((cacheEntry.expires - now) / 60000);
        console.log(`[Prefetch] Cache is warm for: ${channel.name} (expires in ${minutesLeft} mins)`);
      }
    }
    console.log('[Prefetch] Background prefetch completed.');
  } catch (error: any) {
    console.error('[Prefetch] Error during prefetching channels:', error.message);
  } finally {
    isPrefetching = false;
  }
}
