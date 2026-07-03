import YTDlpWrap from 'yt-dlp-wrap';
import path from 'path';
import fs from 'fs';
import { execSync, exec } from 'child_process';
import { promisify } from 'util';

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
interface CacheEntry {
  url: string;
  expires: number;
}
const streamCache: Record<string, CacheEntry> = {};
const CACHE_DURATION = 3 * 60 * 60 * 1000; // 3 hours in milliseconds

/**
 * Returns common yt-dlp arguments including JavaScript runtime configuration
 * and cookie authentication if configured.
 */
function getCommonFlags(): string {
  let flags = '--js-runtimes node';

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
      fs.writeFileSync(cookiesPath, cookiesEnv, 'utf8');
      flags += ` --cookies "${cookiesPath}"`;
      console.log('Using custom YouTube cookies for authentication');
    } catch (e: any) {
      console.error('Failed to write cookies file:', e.message);
    }
  }

  return flags;
}

/**
 * Resolves a YouTube URL to its raw direct media stream URL (M3U8).
 * Utilizes caching to speed up subsequent requests.
 */
export async function resolveStreamUrl(url: string, forceRefresh = false): Promise<string> {
  const now = Date.now();
  if (!forceRefresh && streamCache[url] && streamCache[url].expires > now) {
    console.log('Stream URL resolved from cache:', url);
    return streamCache[url].url;
  }

  const binaryPath = await getYTDlpPath();
  console.log(`Resolving stream URL for: ${url} using ${binaryPath}`);

  // Use standard execution to capture the resolved URL
  // -g outputs the stream URLs directly
  // -f best gets the highest quality stream
  const cmd = `"${binaryPath}" ${getCommonFlags()} -g "${url}"`;
  
  try {
    const { stdout } = await execPromise(cmd);
    const resolvedUrls = stdout.trim().split('\n');
    // If it returns multiple URLs, the last one or first one might be what we need.
    // For HLS streams (live), it usually outputs a single .m3u8 link.
    const resolvedUrl = resolvedUrls[0]?.trim();
    
    if (!resolvedUrl) {
      throw new Error('No stream URL returned by yt-dlp');
    }

    // Cache the resolved URL
    streamCache[url] = {
      url: resolvedUrl,
      expires: now + CACHE_DURATION,
    };

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
