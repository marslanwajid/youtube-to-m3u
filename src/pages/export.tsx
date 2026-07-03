import { useState, useEffect } from 'react';
import Head from 'next/head';
import { Download, Copy, Check, Tv, ShieldCheck, HeartHandshake, Key } from 'lucide-react';

export default function ExportPage() {
  const [m3uUrl, setM3uUrl] = useState('');
  const [epgUrl, setEpgUrl] = useState('');
  const [copiedType, setCopiedType] = useState<string | null>(null);
  const [isAuthEnabled, setIsAuthEnabled] = useState(false);
  const [accessKey, setAccessKey] = useState('');

  useEffect(() => {
    // Check if auth is enabled on the server
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        // If data.disabled is undefined or false, authentication is active
        setIsAuthEnabled(!data.disabled);
        if (!data.disabled && typeof window !== 'undefined') {
          const stored = localStorage.getItem('admin_password') || '';
          setAccessKey(stored);
        }
      })
      .catch((err) => console.error('Failed to check auth status:', err));
  }, []);

  useEffect(() => {
    // Generate absolute URLs based on window location and access key
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol;
      const host = window.location.host;
      const keySuffix = accessKey ? `?key=${encodeURIComponent(accessKey)}` : '';
      setM3uUrl(`${protocol}//${host}/api/m3u${keySuffix}`);
      setEpgUrl(`${protocol}//${host}/api/epg${keySuffix}`);
    }
  }, [accessKey]);

  const handleCopy = (text: string, type: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <>
      <Head>
        <title>YouTube to M3U Converter - Export Playlist</title>
      </Head>

      <div className="page-header">
        <h1>Export Playlist & EPG</h1>
        <p className="subtitle">Connect your generated feeds directly to IPTV players like IPTV Smarters</p>
      </div>

      <div className="grid-2" style={{ marginBottom: '2.5rem' }}>
        {/* Copy URLs Card */}
        <div className="glass-card">
          <h2>Stream Integration URLs</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.5rem' }}>
            Paste these links into your IPTV application. They will dynamically query your server and redirect to the latest streams.
          </p>

          {isAuthEnabled && (
            <div style={{
              background: 'rgba(139, 92, 246, 0.05)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              borderRadius: 'var(--radius-sm)',
              padding: '1rem',
              marginBottom: '1.5rem',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--accent-light)' }}>
                <Key size={16} />
                <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Security Key Protection Active</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Your site is protected. Enter your admin password below to append it to the URLs so your IPTV player can authenticate:
              </p>
              <input
                type="password"
                placeholder="Enter admin password here..."
                value={accessKey}
                onChange={(e) => setAccessKey(e.target.value)}
                style={{
                  padding: '8px 12px',
                  fontSize: '0.85rem',
                  marginTop: '4px',
                  background: 'rgba(0,0,0,0.2)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: '6px',
                  color: '#fff',
                  width: '100%',
                  outline: 'none'
                }}
              />
            </div>
          )}

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>M3U Playlist URL</label>
            <div className="copy-container">
              <input
                type="text"
                readOnly
                className="copy-input"
                value={m3uUrl}
              />
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleCopy(m3uUrl, 'm3u')}
                style={{ minWidth: '46px' }}
              >
                {copiedType === 'm3u' ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label>XMLTV EPG Guide URL</label>
            <div className="copy-container">
              <input
                type="text"
                readOnly
                className="copy-input"
                value={epgUrl}
              />
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={() => handleCopy(epgUrl, 'epg')}
                style={{ minWidth: '46px' }}
              >
                {copiedType === 'epg' ? <Check size={16} style={{ color: 'var(--success)' }} /> : <Copy size={16} />}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', marginTop: '2rem', borderTop: '1px solid var(--card-border)', paddingTop: '1.5rem' }}>
            <a href={`/api/m3u${accessKey ? `?key=${encodeURIComponent(accessKey)}` : ''}`} download className="btn btn-secondary" style={{ flexGrow: 1, fontSize: '0.85rem' }}>
              <Download size={16} />
              Download M3U File
            </a>
            <a href={`/api/epg${accessKey ? `?key=${encodeURIComponent(accessKey)}` : ''}`} download className="btn btn-secondary" style={{ flexGrow: 1, fontSize: '0.85rem' }}>
              <Download size={16} />
              Download EPG XML
            </a>
          </div>
        </div>

        {/* GitHub Gist Settings */}
        <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <h2>Cloud Sync Configuration</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
              If you have deployed this project to <strong>Render</strong> or a cloud server, your changes will be reset on every restart unless you set up GitHub Gist syncing.
            </p>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', background: 'rgba(0,0,0,0.2)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--card-border)' }}>
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
                <ShieldCheck size={18} style={{ color: 'var(--success)', marginTop: '2px' }} />
                <div>
                  <h3 style={{ fontSize: '0.95rem', marginBottom: '0.2rem' }}>How to Configure Gist Syncing:</h3>
                  <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <li>Create a free token on GitHub (Personal Access Token with `gist` scope permission).</li>
                    <li>Create a Secret Gist named `channels.json` with empty brackets `[]` inside.</li>
                    <li>In your Render settings, add these environment variables:
                      <ul style={{ listStyleType: 'square', paddingLeft: '1rem', marginTop: '0.2rem', fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        <li>GITHUB_TOKEN = [your github token]</li>
                        <li>GIST_ID = [your secret gist id from url]</li>
                      </ul>
                    </li>
                  </ol>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', color: 'var(--success)', fontSize: '0.85rem', marginTop: '1.5rem', borderTop: '1px solid var(--card-border)', paddingTop: '1rem' }}>
            <HeartHandshake size={16} />
            <span>This guarantees your database remains active 24/7 for free!</span>
          </div>
        </div>
      </div>

      {/* Tutorials */}
      <h2 style={{ marginBottom: '1.5rem' }}>Setup Tutorials</h2>
      <div className="grid-3">
        {/* IPTV Smarters */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-light)' }}>
              <Tv size={18} />
            </div>
            <h3 style={{ margin: 0 }}>IPTV Smarters</h3>
          </div>
          <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Open the IPTV Smarters Pro app.</li>
            <li>Click <strong>Add New User</strong> and choose <strong>Load Your Playlist or File/URL</strong>.</li>
            <li>Set the Playlist Type to <strong>M3U URL</strong>.</li>
            <li>Enter any playlist name (e.g. <code>YouTube Channels</code>) and paste your <strong>M3U Playlist URL</strong>.</li>
            <li>Once loaded, go to Settings, choose <strong>EPG (TV Guide)</strong>, click <strong>Add EPG</strong>, and paste your <strong>EPG Guide URL</strong>.</li>
            <li>Complete setup, open the Live TV section, and watch!</li>
          </ol>
        </div>

        {/* TiviMate */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-light)' }}>
              <Tv size={18} />
            </div>
            <h3 style={{ margin: 0 }}>TiviMate</h3>
          </div>
          <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Open TiviMate and click <strong>Add Playlist</strong>.</li>
            <li>Select <strong>M3U Playlist</strong>.</li>
            <li>Paste your <strong>M3U Playlist URL</strong> and click Next.</li>
            <li>Wait for the channels to load. Under the playlist settings, select <strong>TV Guide Sources</strong>.</li>
            <li>Click <strong>Add Source</strong> and paste your <strong>EPG Guide URL</strong>.</li>
            <li>Assign the source to your playlist. You will see a complete TV guide with program schedules!</li>
          </ol>
        </div>

        {/* VLC Player */}
        <div className="glass-card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'rgba(139, 92, 246, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-light)' }}>
              <Tv size={18} />
            </div>
            <h3 style={{ margin: 0 }}>VLC Player</h3>
          </div>
          <ol style={{ fontSize: '0.85rem', color: 'var(--text-muted)', paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <li>Launch VLC Media Player on your PC or Mac.</li>
            <li>Go to the top menu and select <strong>Media &gt; Open Network Stream</strong> (or press <code>Ctrl+N</code> / <code>Cmd+N</code>).</li>
            <li>Paste your <strong>M3U Playlist URL</strong> into the network URL box.</li>
            <li>Click <strong>Play</strong>. VLC will resolve the playlist.</li>
            <li>Go to <strong>View &gt; Playlist</strong> (or press <code>Ctrl+L</code>) to view the sidebar with your complete channel listing! Double-click any channel to stream.</li>
          </ol>
        </div>
      </div>
    </>
  );
}
