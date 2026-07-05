import fs from 'fs';
import path from 'path';
import { initKeepAlive } from './keepalive';

// Start keep-alive loop if deployed on Render
initKeepAlive();

export interface Channel {
  id: string; // YouTube Video ID, Playlist ID, or Channel ID
  name: string;
  type: 'video' | 'live' | 'playlist';
  youtubeUrl: string;
  category: string;
  logoUrl?: string;
  enableEpg: boolean;
  addedAt: string;
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
