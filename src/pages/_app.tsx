import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Tv, ListVideo, Play, Download, LogOut, Loader2 } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const currentPath = router.pathname;
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [isAuthDisabled, setIsAuthDisabled] = useState(false);

  useEffect(() => {
    if (currentPath === '/login') {
      setLoading(false);
      return;
    }

    setLoading(true);
    fetch('/api/auth')
      .then((res) => res.json())
      .then((data) => {
        if (data.authenticated) {
          setAuthenticated(true);
          setIsAuthDisabled(!!data.disabled);
          setLoading(false);
        } else {
          // Redirect to login if not authenticated
          router.push(`/login?redirect=${encodeURIComponent(router.asPath)}`);
        }
      })
      .catch(() => {
        setLoading(false);
      });
  }, [currentPath, router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth', { method: 'DELETE' });
      localStorage.removeItem('admin_password');
      router.push('/login');
    } catch (err) {
      console.error('Logout failed:', err);
    }
  };

  // If on login page, render directly without layout
  if (currentPath === '/login') {
    return <Component {...pageProps} />;
  }

  // If checking authentication, show a glassmorphic loader
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: '#080913',
        color: '#fff',
        gap: '12px',
        fontFamily: "'Outfit', sans-serif"
      }}>
        <Loader2 className="animate-spin" size={32} color="#8b5cf6" />
        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.9rem', fontWeight: 500 }}>Verifying Session...</span>
      </div>
    );
  }

  return (
    <div className="app-container">
      <aside className="sidebar">
        <div className="logo-container">
          <div className="logo-icon">YT</div>
          <span className="logo-text">YT to M3U</span>
        </div>
        
        <nav style={{ flexGrow: 1, display: 'flex', flexDirection: 'column' }}>
          <ul className="nav-menu">
            <li className={`nav-item ${currentPath === '/' ? 'active' : ''}`}>
              <Link href="/">
                <Tv size={20} />
                <span>Dashboard</span>
              </Link>
            </li>
            <li className={`nav-item ${currentPath === '/channels' ? 'active' : ''}`}>
              <Link href="/channels">
                <ListVideo size={20} />
                <span>Channels</span>
              </Link>
            </li>
            <li className={`nav-item ${currentPath === '/player' ? 'active' : ''}`}>
              <Link href="/player">
                <Play size={20} />
                <span>Web Player</span>
              </Link>
            </li>
            <li className={`nav-item ${currentPath === '/export' ? 'active' : ''}`}>
              <Link href="/export">
                <Download size={20} />
                <span>Export M3U</span>
              </Link>
            </li>
          </ul>
        </nav>
        
        <div className="sidebar-footer" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {authenticated && !isAuthDisabled && (
            <button 
              onClick={handleLogout}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                width: '100%',
                padding: '8px 12px',
                fontSize: '0.85rem',
                fontWeight: 600,
                border: '1px solid rgba(239, 68, 68, 0.2)',
                background: 'rgba(239, 68, 68, 0.05)',
                color: '#f87171',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.2s',
                fontFamily: "'Outfit', sans-serif"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              }}
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          )}
          <div>
            <p>YouTube to M3U v1.0.0</p>
            <p style={{ marginTop: '0.25rem' }}>100% Free & Open Source</p>
          </div>
        </div>
      </aside>
      
      <main className="main-content">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
