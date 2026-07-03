import "@/styles/globals.css";
import type { AppProps } from "next/app";
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Tv, ListVideo, Play, Download } from 'lucide-react';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const currentPath = router.pathname;

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
        
        <div className="sidebar-footer">
          <p>YouTube to M3U v1.0.0</p>
          <p style={{ marginTop: '0.25rem' }}>100% Free & Open Source</p>
        </div>
      </aside>
      
      <main className="main-content">
        <Component {...pageProps} />
      </main>
    </div>
  );
}
