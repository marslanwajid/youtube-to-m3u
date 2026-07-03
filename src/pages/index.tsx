import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { Tv, Play, ListVideo, Zap, Copy, Check, Video, Radio, FolderHeart } from 'lucide-react';
import { Channel } from '@/utils/db';

export default function Dashboard() {
  const [stats, setStats] = useState({
    total: 0,
    live: 0,
    playlist: 0,
    video: 0,
  });
  const [quickUrl, setQuickUrl] = useState('');
  const [convertedUrl, setConvertedUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data: Channel[] = await res.json();
        const live = data.filter(c => c.type === 'live').length;
        const playlist = data.filter(c => c.type === 'playlist').length;
        const video = data.filter(c => c.type === 'video').length;
        setStats({
          total: data.length,
          live,
          playlist,
          video,
        });
      }
    } catch (e) {
      console.error('Failed to load stats:', e);
    }
  };

  const handleQuickConvert = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setConvertedUrl('');

    if (!quickUrl) {
      setError('Please paste a YouTube URL');
      return;
    }

    setLoading(true);

    // Parse YouTube ID
    let id = '';
    const videoMatch = quickUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i);
    const playlistMatch = quickUrl.match(/[?&]list=([^#\&\?]+)/i);
    const channelLiveMatch = quickUrl.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)\/live/i) || quickUrl.includes('/live');

    if (playlistMatch) {
      id = playlistMatch[1];
    } else if (videoMatch) {
      id = videoMatch[1];
    } else if (channelLiveMatch) {
      const handleMatch = quickUrl.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)/i);
      id = handleMatch ? handleMatch[1] : 'live';
    }

    if (!id) {
      setError('Could not extract a YouTube Video ID, Playlist ID, or Channel ID. Make sure it is a valid YouTube URL.');
      setLoading(false);
      return;
    }

    // Construct the play endpoint redirect URL
    const protocol = window.location.protocol;
    const host = window.location.host;
    const streamLink = `${protocol}//${host}/api/play?id=${id}`;
    
    setTimeout(() => {
      setConvertedUrl(streamLink);
      setLoading(false);
    }, 600);
  };

  const copyToClipboard = () => {
    if (!convertedUrl) return;
    navigator.clipboard.writeText(convertedUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Head>
        <title>YouTube to M3U Converter - Dashboard</title>
        <meta name="description" content="Convert YouTube Live streams and playlists to M3U format for IPTV clients." />
      </Head>

      <div className="page-header">
        <h1>Dashboard</h1>
        <p className="subtitle">Manage and convert YouTube streams into stable IPTV channels</p>
      </div>

      <div className="grid-4" style={{ marginBottom: '2.5rem' }}>
        <div className="glass-card stat-card">
          <div className="stat-icon">
            <Tv size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.total}</div>
            <div className="stat-label">Total Channels</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#ef4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
            <Radio size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.live}</div>
            <div className="stat-label">Live Broadcasts</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#3b82f6', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}>
            <FolderHeart size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.playlist}</div>
            <div className="stat-label">Playlists</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ color: '#10b981', backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}>
            <Video size={24} />
          </div>
          <div className="stat-info">
            <div className="stat-value">{stats.video}</div>
            <div className="stat-label">Videos</div>
          </div>
        </div>
      </div>

      <div className="grid-2">
        {/* Quick Convert Tool */}
        <div className="glass-card">
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
            <Zap size={22} style={{ color: 'var(--accent-light)' }} />
            Quick Stream Resolver
          </h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Convert any YouTube video or live URL instantly into a permanent stream link. 
            No need to save it to your channel list.
          </p>

          <form onSubmit={handleQuickConvert}>
            <div className="form-group">
              <label htmlFor="quick-url">YouTube URL</label>
              <input
                id="quick-url"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={quickUrl}
                onChange={(e) => setQuickUrl(e.target.value)}
              />
            </div>
            {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1rem' }}>{error}</p>}
            
            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
              {loading ? 'Resolving...' : 'Generate Stream Link'}
            </button>
          </form>

          {convertedUrl && (
            <div style={{ marginTop: '2rem', animation: 'fadeIn 0.3s ease-out' }}>
              <label>Your IPTV-Compatible Stream URL</label>
              <div className="copy-container">
                <input
                  type="text"
                  readOnly
                  className="copy-input"
                  value={convertedUrl}
                />
                <button className="btn btn-secondary btn-sm" onClick={copyToClipboard} style={{ minWidth: '46px' }}>
                  {copied ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
                </button>
              </div>
              <p style={{ color: 'var(--success)', fontSize: '0.8rem', marginTop: '0.5rem' }}>
                🎉 Paste this link directly into VLC or IPTV Smarters to stream!
              </p>
            </div>
          )}
        </div>

        {/* Getting Started Guide */}
        <div className="glass-card">
          <h2>Getting Started</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', marginTop: '1rem' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ 
                minWidth: '28px', height: '28px', borderRadius: '50%', 
                background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: '700', fontSize: '0.9rem' 
              }}>
                1
              </div>
              <div>
                <h3 style={{ marginBottom: '0.2rem', fontSize: '1rem' }}>Add Your Channels</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Navigate to the <Link href="/channels" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>Channels</Link> page. Paste your favorite YouTube live stream, channel, or playlist URLs. The application will fetch titles and logos automatically.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ 
                minWidth: '28px', height: '28px', borderRadius: '50%', 
                background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: '700', fontSize: '0.9rem' 
              }}>
                2
              </div>
              <div>
                <h3 style={{ marginBottom: '0.2rem', fontSize: '1rem' }}>Test Playback</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Open the <Link href="/player" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>Web Player</Link> to watch your feeds directly in the browser. It runs the same stream resolver that your external IPTV apps will use.
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem' }}>
              <div style={{ 
                minWidth: '28px', height: '28px', borderRadius: '50%', 
                background: 'rgba(139, 92, 246, 0.15)', color: 'var(--accent-light)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', 
                fontWeight: '700', fontSize: '0.9rem' 
              }}>
                3
              </div>
              <div>
                <h3 style={{ marginBottom: '0.2rem', fontSize: '1rem' }}>Load into IPTV Player</h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Go to <Link href="/export" style={{ color: 'var(--accent-light)', textDecoration: 'none' }}>Export M3U</Link>. Copy the M3U playlist link and EPG link. Paste these into IPTV Smarters, TiviMate, or VLC. You are ready to watch!
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
