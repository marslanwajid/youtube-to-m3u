import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Play, Volume2, Info, List, Radio, AlertCircle, ExternalLink } from 'lucide-react';
import { Channel } from '@/utils/db';
import Hls from 'hls.js';

export default function PlayerPage() {
  const router = useRouter();
  const { play } = router.query;

  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  
  // Player states
  const [loading, setLoading] = useState(false);
  const [playerError, setPlayerError] = useState('');
  const [streamUrl, setStreamUrl] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  // Sync selected channel with query param ?play=CHANNEL_ID
  useEffect(() => {
    if (channels.length > 0 && play) {
      const channel = channels.find(c => c.id === play);
      if (channel) {
        handleSelectChannel(channel);
      }
    }
  }, [channels, play]);

  // Clean up HLS instance on unmount
  useEffect(() => {
    return () => {
      destroyPlayer();
    };
  }, []);

  const fetchChannels = async () => {
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data = await res.json();
        setChannels(data);
        // Play first channel if no query param is set
        if (data.length > 0 && !play) {
          handleSelectChannel(data[0]);
        }
      }
    } catch (e) {
      console.error('Failed to load channels for player:', e);
    }
  };

  const destroyPlayer = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
  };

  const handleSelectChannel = (channel: Channel) => {
    setSelectedChannel(channel);
    setPlayerError('');
    setLoading(true);

    const storedKey = typeof window !== 'undefined' ? localStorage.getItem('admin_password') || '' : '';
    const keyParam = storedKey ? `&key=${encodeURIComponent(storedKey)}` : '';
    const ext = channel.type === 'live' ? '&ext=.m3u8' : '&ext=.mp4';
    const playUrl = `/api/play?id=${channel.id}${keyParam}${ext}`;
    setStreamUrl(playUrl);

    // Give state a moment to update before mounting the stream
    setTimeout(() => {
      initPlayer(playUrl);
    }, 100);
  };

  const initPlayer = (url: string) => {
    const video = videoRef.current;
    if (!video) return;

    destroyPlayer();

    if (Hls.isSupported()) {
      const hls = new Hls({
        maxMaxBufferLength: 10,
        enableWorker: true,
        lowLatencyMode: true,
      });
      hlsRef.current = hls;
      hls.loadSource(url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, () => {
        setLoading(false);
        video.play().catch(e => {
          console.warn('Auto-play blocked by browser. User interaction needed:', e.message);
        });
      });

      hls.on(Hls.Events.ERROR, (event, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.error('Fatal network error, trying to recover...', data);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.error('Fatal media error, trying to recover...', data);
              hls.recoverMediaError();
              break;
            default:
              console.error('Fatal playback error, stopping:', data);
              setPlayerError('Stream could not be played. The live feed might be offline or private.');
              setLoading(false);
              destroyPlayer();
              break;
          }
        }
      });
    } 
    // Fallback for Safari/iOS native HLS support
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = url;
      video.addEventListener('loadedmetadata', () => {
        setLoading(false);
        video.play().catch(e => {
          console.warn('Auto-play blocked by Safari:', e.message);
        });
      });
      video.addEventListener('error', () => {
        setPlayerError('Stream playback failed. Make sure the channel is online.');
        setLoading(false);
      });
    } else {
      setPlayerError('Your browser does not support HLS streaming.');
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>YouTube to M3U Converter - Web Player</title>
      </Head>

      <div className="page-header">
        <h1>Built-in Web Player</h1>
        <p className="subtitle">Preview your configured YouTube feeds directly in the browser</p>
      </div>

      {channels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '5rem' }}>
          <AlertCircle size={48} style={{ color: 'var(--text-dark)', marginBottom: '1rem' }} />
          <h3>No Channels Available</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: '0.5rem 0 1.5rem' }}>
            You need to add at least one channel before you can preview streams.
          </p>
          <button className="btn btn-primary btn-sm" onClick={() => router.push('/channels')}>
            Manage Channels
          </button>
        </div>
      ) : (
        <div className="player-page-container">
          {/* Main Player */}
          <div className="player-main">
            <div className="video-wrapper">
              {loading && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', zIndex: 10, gap: '1rem'
                }}>
                  <div style={{
                    width: '40px', height: '40px', border: '3px solid rgba(139, 92, 246, 0.2)',
                    borderTopColor: 'var(--accent)', borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Resolving stream URL from YouTube...</p>
                </div>
              )}

              {playerError && (
                <div style={{
                  position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
                  background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: '2rem',
                  textAlign: 'center', gap: '1rem'
                }}>
                  <AlertCircle size={44} style={{ color: 'var(--danger)' }} />
                  <div>
                    <h3 style={{ marginBottom: '0.25rem' }}>Playback Error</h3>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', maxWidth: '380px' }}>{playerError}</p>
                  </div>
                  <button className="btn btn-secondary btn-sm" onClick={() => selectedChannel && handleSelectChannel(selectedChannel)}>
                    Retry Playback
                  </button>
                </div>
              )}

              <video
                ref={videoRef}
                className="video-element"
                controls
                playsInline
                crossOrigin="anonymous"
              />
            </div>

            {/* Video Details */}
            {selectedChannel && (
              <div className="glass-card" style={{ padding: '1.25rem', display: 'flex', gap: '1.25rem', alignItems: 'center' }}>
                <img
                  src={selectedChannel.logoUrl || 'https://www.youtube.com/favicon.ico'}
                  alt={selectedChannel.name}
                  style={{ width: '48px', height: '48px', borderRadius: '6px', objectFit: 'cover', border: '1px solid var(--card-border)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://www.youtube.com/favicon.ico';
                  }}
                />
                <div style={{ flexGrow: 1 }}>
                  <h2 style={{ fontSize: '1.2rem', margin: 0, fontWeight: '700' }}>{selectedChannel.name}</h2>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginTop: '0.25rem' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(255,255,255,0.06)', color: 'var(--text-muted)' }}>
                      {selectedChannel.category}
                    </span>
                    <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: '0.75rem', fontWeight: '600', padding: '0.15rem 0.4rem', borderRadius: '4px', background: 'rgba(139, 92, 246, 0.1)', color: 'var(--accent-light)' }}>
                      <Radio size={10} style={{ marginRight: '3px' }} />
                      {selectedChannel.type.toUpperCase()}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const protocol = window.location.protocol;
                      const host = window.location.host;
                      navigator.clipboard.writeText(`${protocol}//${host}/api/play?id=${selectedChannel.id}`);
                      alert('Stream link copied to clipboard!');
                    }}
                  >
                    Copy Link
                  </button>
                  <a 
                    href={selectedChannel.youtubeUrl} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="btn btn-secondary btn-sm"
                    style={{ minWidth: '38px', padding: '0.5rem' }}
                    title="Open on YouTube"
                  >
                    <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar channel selector */}
          <div className="player-sidebar">
            <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderBottom: '1px solid var(--card-border)', paddingBottom: '0.75rem' }}>
              <List size={18} />
              Channels List
            </h3>
            <div className="player-channel-list">
              {channels.map(channel => (
                <div
                  key={channel.id}
                  className={`player-channel-item ${selectedChannel?.id === channel.id ? 'active' : ''}`}
                  onClick={() => handleSelectChannel(channel)}
                >
                  <img
                    src={channel.logoUrl || 'https://www.youtube.com/favicon.ico'}
                    alt={channel.name}
                    className="player-channel-logo"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://www.youtube.com/favicon.ico';
                    }}
                  />
                  <div className="player-channel-name" title={channel.name}>
                    {channel.name}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
}
