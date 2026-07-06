import fs from 'fs';
import path from 'path';
import { initKeepAlive } from './keepalive';

// Start keep-alive loop if deployed on Render
initKeepAlive();

export interface Channel {
  id: string; // YouTube Video ID, Playlist ID, or Channel ID
  name: string;
  type: 'video' | 'live' | 'playlist' | 'vod';
  youtubeUrl: string;
  category: string;
  logoUrl?: string;
  enableEpg: boolean;
  addedAt: string;
  vodLimit?: number;     // max videos for VOD channel (default 10)
  vodKeyword?: string;   // optional title filter for VOD videos
  vodChannelId?: string; // parent channel ID for individual VOD picks
}

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

// Global environment variables
const GIST_ID = process.env.GIST_ID || '';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';

/**
 * Ensures the data directory and db.json file exist locally.
 */
function ensureLocalDbExists() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, '[]', 'utf8');
  }
}

/**
 * Fetches channels from either local db.json or GitHub Gist.
 */
export async function getChannels(): Promise<Channel[]> {
  // If GitHub integration is configured, read from Gist
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      console.log(`Fetching channels from GitHub Gist: ${GIST_ID}`);
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub Gist API returned status ${res.status}`);
      }

      const data = await res.json();
      const gistFile = data.files['channels.json'];
      
      if (gistFile && gistFile.content) {
        return JSON.parse(gistFile.content);
      }
      return [];
    } catch (error: any) {
      console.error('Error fetching channels from Gist, falling back to local database:', error.message);
    }
  }

  // Fallback to local db.json
  ensureLocalDbExists();
  try {
    const rawData = fs.readFileSync(DB_PATH, 'utf8');
    return JSON.parse(rawData);
  } catch (error) {
    console.error('Error reading local db.json, returning empty array:', error);
    return [];
  }
}

/**
 * Saves channels list to either local db.json or GitHub Gist.
 */
export async function saveChannels(channels: Channel[]): Promise<void> {
  // If GitHub integration is configured, write to Gist
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      console.log(`Saving channels to GitHub Gist: ${GIST_ID}`);
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
        body: JSON.stringify({
          files: {
            'channels.json': {
              content: JSON.stringify(channels, null, 2),
            },
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`GitHub Gist API returned status ${res.status}`);
      }
      console.log('Channels saved to GitHub Gist successfully.');
      return;
    } catch (error: any) {
      console.error('Error saving channels to Gist, falling back to local database write:', error.message);
    }
  }

  // Fallback to local db.json
  ensureLocalDbExists();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(channels, null, 2), 'utf8');
    console.log('Channels saved to local db.json successfully.');
  } catch (error) {
    console.error('Error writing to local db.json:', error);
    throw error;
  }
}

/**
 * Adds a new channel.
 */
export async function addChannel(channelData: Omit<Channel, 'addedAt'>): Promise<Channel> {
  const channels = await getChannels();
  
  // Check if channel already exists
  if (channels.some(c => c.id === channelData.id)) {
    throw new Error('Channel with this ID already exists in the playlist.');
  }

  const newChannel: Channel = {
    ...channelData,
    addedAt: new Date().toISOString(),
  };

  channels.push(newChannel);
  await saveChannels(channels);
  return newChannel;
}

/**
 * Deletes a channel by ID.
 */
export async function deleteChannel(id: string): Promise<void> {
  const channels = await getChannels();
  const filtered = channels.filter(c => c.id !== id);
  
  if (channels.length === filtered.length) {
    throw new Error('Channel not found.');
  }

  await saveChannels(filtered);
}

/**
 * Updates an existing channel.
 */
export async function updateChannel(id: string, updatedData: Partial<Channel>): Promise<Channel> {
  const channels = await getChannels();
  const index = channels.findIndex(c => c.id === id);

  if (index === -1) {
    throw new Error('Channel not found.');
  }

  const updatedChannel = {
    ...channels[index],
    ...updatedData,
    id, // Keep original ID
  };

  channels[index] = updatedChannel;
  await saveChannels(channels);
  return updatedChannel;
}

const CACHE_PATH = path.join(DATA_DIR, 'stream_cache.json');

/**
 * Fetches the stream cache from the GitHub Gist.
 */
export async function getStreamCacheFromGist(): Promise<Record<string, any> | null> {
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      console.log(`Fetching stream cache from GitHub Gist: ${GIST_ID}`);
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
      });

      if (!res.ok) {
        throw new Error(`GitHub Gist API returned status ${res.status}`);
      }

      const data = await res.json();
      const gistFile = data.files['stream_cache.json'];
      
      if (gistFile && gistFile.content) {
        return JSON.parse(gistFile.content);
      }
    } catch (error: any) {
      console.error('Error fetching stream cache from Gist:', error.message);
    }
  }
  return null;
}

/**
 * Saves the stream cache to the GitHub Gist.
 */
export async function saveStreamCacheToGist(cache: Record<string, any>): Promise<void> {
  if (GITHUB_TOKEN && GIST_ID) {
    try {
      console.log(`Saving stream cache to GitHub Gist: ${GIST_ID}`);
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
        body: JSON.stringify({
          files: {
            'stream_cache.json': {
              content: JSON.stringify(cache, null, 2),
            },
          },
        }),
      });

      if (!res.ok) {
        throw new Error(`GitHub Gist API returned status ${res.status}`);
      }
      console.log('Stream cache saved to GitHub Gist successfully.');
    } catch (error: any) {
      console.error('Error saving stream cache to Gist:', error.message);
    }
  }
}

/**
 * Loads the stream cache from the local file and Gist.
 */
export async function loadStreamCache(): Promise<Record<string, any>> {
  let localCache: Record<string, any> = {};
  ensureLocalDbExists();
  try {
    if (fs.existsSync(CACHE_PATH)) {
      const rawData = fs.readFileSync(CACHE_PATH, 'utf8');
      localCache = JSON.parse(rawData);
    }
  } catch (error) {
    console.error('Error reading local stream_cache.json:', error);
  }

  if (GITHUB_TOKEN && GIST_ID) {
    const gistCache = await getStreamCacheFromGist();
    if (gistCache) {
      const now = Date.now();
      const merged: Record<string, any> = {};
      
      // Load valid local entries
      for (const [key, entry] of Object.entries(localCache)) {
        if (entry && typeof entry === 'object' && 'expires' in entry && entry.expires > now) {
          merged[key] = entry;
        }
      }
      
      // Merge valid gist entries
      for (const [key, entry] of Object.entries(gistCache)) {
        if (entry && typeof entry === 'object' && 'expires' in entry && entry.expires > now) {
          if (!merged[key] || entry.expires > merged[key].expires) {
            merged[key] = entry;
          }
        }
      }
      
      return merged;
    }
  }

  const now = Date.now();
  const filtered: Record<string, any> = {};
  for (const [key, entry] of Object.entries(localCache)) {
    if (entry && typeof entry === 'object' && 'expires' in entry && entry.expires > now) {
      filtered[key] = entry;
    }
  }
  return filtered;
}

/**
 * Saves the stream cache locally and to the Gist.
 */
export async function saveStreamCache(cache: Record<string, any>): Promise<void> {
  const now = Date.now();
  const cleanedCache: Record<string, any> = {};
  for (const [key, entry] of Object.entries(cache)) {
    if (entry && typeof entry === 'object' && 'expires' in entry && entry.expires > now) {
      cleanedCache[key] = entry;
    }
  }

  ensureLocalDbExists();
  try {
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cleanedCache, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing local stream_cache.json:', error);
  }

  if (GITHUB_TOKEN && GIST_ID) {
    saveStreamCacheToGist(cleanedCache).catch(err => {
      console.error('Error saving stream cache to Gist in background:', err);
    });
  }
}

const VOD_CACHE_PATH = path.join(DATA_DIR, 'vod_cache.json');

export interface VodCacheEntry {
  id: string;
  title: string;
  thumbnail: string;
  duration?: number;
}

let vodCache: Record<string, { entries: VodCacheEntry[]; fetchedAt: number }> = {};
let vodCacheLoaded = false;

export async function loadVodCache(): Promise<typeof vodCache> {
  if (vodCacheLoaded) return vodCache;
  vodCacheLoaded = true;

  ensureLocalDbExists();
  try {
    if (fs.existsSync(VOD_CACHE_PATH)) {
      const raw = fs.readFileSync(VOD_CACHE_PATH, 'utf8');
      vodCache = JSON.parse(raw);
    }
  } catch (error) {
    console.error('Error reading local vod_cache.json:', error);
  }

  if (GITHUB_TOKEN && GIST_ID) {
    try {
      const res = await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
      });
      if (res.ok) {
        const data = await res.json();
        const gistFile = data.files['vod_cache.json'];
        if (gistFile && gistFile.content) {
          const gistCache = JSON.parse(gistFile.content);
          const now = Date.now();
          for (const [key, entry] of Object.entries(gistCache)) {
            const e = entry as any;
            if (e && e.entries && e.fetchedAt && e.fetchedAt > (vodCache[key]?.fetchedAt || 0)) {
              vodCache[key] = e;
            }
          }
        }
      }
    } catch (error: any) {
      console.error('Error fetching VOD cache from Gist:', error.message);
    }
  }

  return vodCache;
}

export async function saveVodCache(cache: typeof vodCache): Promise<void> {
  ensureLocalDbExists();
  try {
    fs.writeFileSync(VOD_CACHE_PATH, JSON.stringify(cache, null, 2), 'utf8');
  } catch (error) {
    console.error('Error writing local vod_cache.json:', error);
  }

  if (GITHUB_TOKEN && GIST_ID) {
    try {
      await fetch(`https://api.github.com/gists/${GIST_ID}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'Content-Type': 'application/json',
          'User-Agent': 'YouTube-to-M3U-Converter',
        },
        body: JSON.stringify({
          files: {
            'vod_cache.json': { content: JSON.stringify(cache, null, 2) },
          },
        }),
      });
    } catch (error: any) {
      console.error('Error saving VOD cache to Gist:', error.message);
    }
  }
}

export function getVodCache(): typeof vodCache {
  return vodCache;
}

export function setVodCacheEntry(channelId: string, entries: VodCacheEntry[]): void {
  vodCache[channelId] = { entries, fetchedAt: Date.now() };
}

