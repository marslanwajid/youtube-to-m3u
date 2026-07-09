import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ListVideo, Plus, Search, Edit2, Trash2, Copy, Check, ExternalLink, Play, Radio, FolderHeart, Video, Film } from 'lucide-react';
import { Channel } from '@/utils/db';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [enableEpg, setEnableEpg] = useState(true);

  const [isChannelUrl, setIsChannelUrl] = useState(false);
  const [scanTab, setScanTab] = useState<'live' | 'videos'>('live');
  const [fetchingStreams, setFetchingStreams] = useState(false);
  const [channelStreams, setChannelStreams] = useState<any[]>([]);
  const [selectedStreamId, setSelectedStreamId] = useState('');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedVideoIds, setSelectedVideoIds] = useState<Set<string>>(new Set());
  const [videoSearch, setVideoSearch] = useState('');

  useEffect(() => {
    const isChannel = youtubeUrl.includes('/channel/') || 
                      youtubeUrl.includes('/c/') || 
                      youtubeUrl.includes('/@') || 
                      youtubeUrl.includes('/streams') || 
                      youtubeUrl.includes('/live') ||
                      youtubeUrl.includes('/videos');
    setIsChannelUrl(isChannel && !youtubeUrl.includes('watch?v='));
  }, [youtubeUrl]);

  const getDefaultKeyword = (title: string): string => {
    const t = title.toLowerCase();
    if (t.includes('makkah') || t.includes('mecca')) return 'Makkah';
    if (t.includes('مكة')) return 'مكة';
    if (t.includes('madinah') || t.includes('madina')) return 'Madinah';
    if (t.includes('المدينة')) return 'المدينة';
    if (t.includes('خطبة') || t.includes('sermon')) return 'خطبة';
    
    const clean = title
      .replace(/[^\w\s\u0600-\u06FF]/g, '')
      .trim()
      .split(/\s+/)
      .filter(Boolean);
    return clean.slice(0, 2).join(' ') || 'Live';
  };

  const getChannelHandle = (url: string): string => {
    const match = url.match(/(https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[^#\&\?\/]+)/i);
    return match ? match[1] : url;
  };

  const handleFetchStreams = async () => {
    setFetchingStreams(true);
    setError('');
    setChannelStreams([]);
    setSelectedStreamId('');
    setSelectedVideoIds(new Set());
    setVideoSearch('');
    try {
      const res = await fetch(`/api/streams?url=${encodeURIComponent(getChannelHandle(youtubeUrl))}&tab=${scanTab}`);
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || `Failed to scan channel ${scanTab}`);
      }
      const data = await res.json();
      const entries = data.entries || [];
      setChannelStreams(entries);
      if (entries.length === 0) {
        setError(scanTab === 'live'
          ? 'No active live streams found on this channel. Make sure it is broadcasting live.'
          : 'No videos found on this channel. Make sure it has public uploads.');
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setFetchingStreams(false);
    }
  };

  const handleSelectStream = (stream: any) => {
    setSelectedStreamId(stream.id);
    setName(stream.title);
    setLogoUrl(stream.thumbnail);
    
    const keyword = getDefaultKeyword(stream.title);
    setSearchKeyword(keyword);
    
    let baseUrl = youtubeUrl;
    const streamsMatch = youtubeUrl.match(/(https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[^#\&\?\/]+)/i);
    if (streamsMatch && streamsMatch[1]) {
      baseUrl = streamsMatch[1];
    }
    
    setYoutubeUrl(`${baseUrl}/streams?q=${encodeURIComponent(keyword)}`);
  };

  const toggleVideoSelection = (videoId: string) => {
    setSelectedVideoIds(prev => {
      const next = new Set(prev);
      if (next.has(videoId)) next.delete(videoId);
      else next.add(videoId);
      return next;
    });
  };

  const handleAddSelectedVideos = async () => {
    if (selectedVideoIds.size === 0) return;
    setLoading(true);
    setError('');

    const selected = channelStreams.filter(s => selectedVideoIds.has(s.id));
    const channelHandle = getChannelHandle(youtubeUrl);
    const handleMatch = channelHandle.match(/youtube\.com\/(?:channel\/|c\/|@)([^#\&\?\/]+)/i);
    const vodChannelId = handleMatch ? (handleMatch[1].startsWith('@') ? handleMatch[1] : handleMatch[1]) : '';

    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl: channelHandle,
          type: 'vod',
          category: category || 'General',
          enableEpg,
          vodLimit: 1,
          vodChannelId,
          selectedVideos: selected.map(v => ({ id: v.id, title: v.title, thumbnail: v.thumbnail })),
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add selected videos');
      }

      await fetchChannels();
      setIsAddModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAddAsVodChannel = () => {
    setYoutubeUrl(getChannelHandle(youtubeUrl));
    setName(name || channelStreams[0]?.title || '');
  };

  const updateKeywordInUrl = (keyword: string) => {
    setSearchKeyword(keyword);
    let baseUrl = youtubeUrl;
    const streamsMatch = youtubeUrl.match(/(https?:\/\/(?:www\.)?youtube\.com\/(?:channel\/|c\/|@)[^#\&\?\/]+)/i);
    if (streamsMatch && streamsMatch[1]) {
      baseUrl = streamsMatch[1];
    }
    setYoutubeUrl(`${baseUrl}/streams?q=${encodeURIComponent(keyword)}`);
  };

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState('');

  useEffect(() => {
    fetchChannels();
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('admin_password') || '';
      setAccessKey(stored);
    }
  }, []);

  useEffect(() => {
    filterChannels();
  }, [channels, searchTerm, selectedCategory]);

  const fetchChannels = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/channels');
      if (res.ok) {
        const data: Channel[] = await res.json();
        setChannels(data);
        const cats = Array.from(new Set(data.map(c => c.category)));
        setCategories(cats);
      }
    } catch (e) {
      console.error('Failed to fetch channels:', e);
    } finally {
      setLoading(false);
    }
  };

  const filterChannels = () => {
    let result = [...channels];

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.name.toLowerCase().includes(term) || 
        c.category.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term)
      );
    }

    if (selectedCategory !== 'All') {
      result = result.filter(c => c.category === selectedCategory);
    }

    setFilteredChannels(result);
  };

  const openAddModal = () => {
    setYoutubeUrl('');
    setName('');
    setCategory('General');
    setLogoUrl('');
    setEnableEpg(true);
    setError('');
    setChannelStreams([]);
    setSelectedStreamId('');
    setSearchKeyword('');
    setSelectedVideoIds(new Set());
    setVideoSearch('');
    setScanTab('live');
    setIsAddModalOpen(true);
  };

  const handleAddChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!youtubeUrl) {
      setError('YouTube URL is required');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          youtubeUrl,
          name,
          category: category || 'General',
          logoUrl,
          enableEpg,
          type: scanTab === 'videos' ? 'vod' : undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add channel');
      }

      await fetchChannels();
      setIsAddModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (channel: Channel) => {
    setActiveChannel(channel);
    setYoutubeUrl(channel.youtubeUrl);
    setName(channel.name);
    setCategory(channel.category);
    setLogoUrl(channel.logoUrl || '');
    setEnableEpg(channel.enableEpg);
    setError('');
    setIsEditModalOpen(true);
  };

  const handleEditChannel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChannel) return;
    setError('');

    setLoading(true);
    try {
      const res = await fetch('/api/channels', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: activeChannel.id,
          youtubeUrl,
          name,
          category,
          logoUrl,
          enableEpg,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to update channel');
      }

      await fetchChannels();
      setIsEditModalOpen(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteChannel = async (id: string) => {
    if (!confirm('Are you sure you want to delete this channel?')) return;

    try {
      const res = await fetch(`/api/channels?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to delete channel');
      }

      await fetchChannels();
    } catch (e: any) {
      alert(e.message);
    }
  };

  const copyStreamLink = (channel: Channel) => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const keyParam = accessKey ? `&key=${encodeURIComponent(accessKey)}` : '';
    const ext = channel.type === 'live' ? '&ext=.m3u8' : '&ext=.mp4';
    const playUrl = `${protocol}//${host}/api/play?id=${channel.id}${keyParam}${ext}`;
    
    navigator.clipboard.writeText(playUrl);
    setCopiedId(channel.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'live':
        return <Radio size={12} style={{ color: '#ef4444', marginRight: '4px' }} />;
      case 'playlist':
        return <FolderHeart size={12} style={{ color: '#3b82f6', marginRight: '4px' }} />;
      case 'vod':
        return <Film size={12} style={{ color: '#f59e0b', marginRight: '4px' }} />;
      default:
        return <Video size={12} style={{ color: '#10b981', marginRight: '4px' }} />;
    }
  };

  const filteredStreamEntries = scanTab === 'videos' && videoSearch
    ? channelStreams.filter(s => s.title?.toLowerCase().includes(videoSearch.toLowerCase()))
    : channelStreams;

  return (
    <>
      <Head>
        <title>YouTube to M3U Converter - Channels</title>
      </Head>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: '1rem', flexWrap: 'wrap' }}>
        <div>
          <h1>Channels Manager</h1>
          <p className="subtitle">Add and configure YouTube URLs for your M3U playlist</p>
        </div>
        <button className="btn btn-primary" onClick={openAddModal}>
          <Plus size={18} />
          Add Channel
        </button>
      </div>

      <div className="glass-card" style={{ padding: '1.25rem', marginBottom: '2rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ flexGrow: 1, position: 'relative', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '15px', color: 'var(--text-dark)' }} />
          <input
            type="text"
            placeholder="Search channel name, ID, or category..."
            style={{ paddingLeft: '2.75rem' }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ minWidth: '180px' }}>
          <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
            <option value="All">All Categories</option>
            {categories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && channels.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading channels...</p>
        </div>
      ) : filteredChannels.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '4rem' }}>
          <ListVideo size={48} style={{ color: 'var(--text-dark)', marginBottom: '1rem' }} />
          <h3>No Channels Found</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginTop: '0.25rem', marginBottom: '1.5rem' }}>
            {searchTerm || selectedCategory !== 'All' ? 'Try adjusting your search filters.' : 'Get started by adding your first YouTube channel or playlist!'}
          </p>
          {!(searchTerm || selectedCategory !== 'All') && (
            <button className="btn btn-primary btn-sm" onClick={openAddModal}>
              <Plus size={16} /> Add Channel
            </button>
          )}
        </div>
      ) : (
        <div className="channel-grid">
          {filteredChannels.map(channel => (
            <div key={channel.id} className="glass-card channel-card">
              <div className="channel-card-header">
                <img
                  src={channel.logoUrl || 'https://www.youtube.com/favicon.ico'}
                  alt={channel.name}
                  className="channel-logo"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'https://www.youtube.com/favicon.ico';
                  }}
                />
                <div className="channel-meta">
                  <div className="channel-title" title={channel.name}>{channel.name}</div>
                  <div className="channel-tag">
                    {getTypeIcon(channel.type)}
                    {channel.type.toUpperCase()}
                    {channel.type === 'vod' && channel.vodLimit && channel.vodLimit > 1 && (
                      <span style={{ marginLeft: '4px', fontSize: '0.65rem', opacity: 0.7 }}>({channel.vodLimit})</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="channel-body">
                <p><strong>Category:</strong> {channel.category}</p>
                <p style={{ marginTop: '0.25rem', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                  <strong>Source ID:</strong> <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{channel.id}</span>
                </p>
              </div>

              <div className="channel-footer">
                <Link href={`/player?play=${channel.id}`} className="btn btn-secondary btn-sm" style={{ flexGrow: 1 }} title="Test Playback">
                  <Play size={14} style={{ color: 'var(--success)' }} />
                  Play
                </Link>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => copyStreamLink(channel)} 
                  title="Copy IPTV Stream URL"
                  style={{ minWidth: '40px' }}
                >
                  {copiedId === channel.id ? <Check size={14} style={{ color: 'var(--success)' }} /> : <Copy size={14} />}
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => openEditModal(channel)} 
                  title="Edit Channel"
                  style={{ minWidth: '40px' }}
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={() => handleDeleteChannel(channel.id)} 
                  title="Delete Channel"
                  style={{ minWidth: '40px', borderColor: 'rgba(239,68,68,0.2)' }}
                >
                  <Trash2 size={14} style={{ color: 'var(--danger)' }} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Add New Channel</h2>
            <form onSubmit={handleAddChannel}>
              <div className="form-group">
                <label htmlFor="url">YouTube URL *</label>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <input
                    id="url"
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=... or channel URL"
                    required
                    style={{ flexGrow: 1 }}
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                  />
                  {isChannelUrl && (
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        type="button" 
                        className={`btn ${scanTab === 'live' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => { setScanTab('live'); setChannelStreams([]); setError(''); setSelectedVideoIds(new Set()); }}
                        disabled={fetchingStreams}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Radio size={14} style={{ marginRight: '4px' }} />
                        Live
                      </button>
                      <button 
                        type="button" 
                        className={`btn ${scanTab === 'videos' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                        onClick={() => { setScanTab('videos'); setChannelStreams([]); setError(''); setSelectedVideoIds(new Set()); }}
                        disabled={fetchingStreams}
                        style={{ whiteSpace: 'nowrap' }}
                      >
                        <Film size={14} style={{ marginRight: '4px' }} />
                        Videos
                      </button>
                      <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={handleFetchStreams} 
                        disabled={fetchingStreams}
                        style={{ padding: '0 1rem', whiteSpace: 'nowrap' }}
                      >
                        {fetchingStreams ? 'Scanning...' : 'Scan'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {channelStreams.length > 0 && scanTab === 'videos' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                    <label style={{ fontSize: '0.85rem', color: 'var(--text-dark)', margin: 0 }}>Recent Videos — Select Individual or Add as VOD</label>
                    <div style={{ flexGrow: 1 }} />
                    <Search size={14} style={{ color: 'var(--text-dark)' }} />
                    <input
                      type="text"
                      placeholder="Filter results..."
                      value={videoSearch}
                      onChange={(e) => setVideoSearch(e.target.value)}
                      style={{ padding: '4px 8px', fontSize: '0.8rem', width: '160px' }}
                    />
                  </div>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', 
                    gap: '0.75rem', 
                    maxHeight: '200px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '6px', 
                    padding: '0.75rem', 
                    background: 'rgba(0,0,0,0.15)' 
                  }}>
                    {filteredStreamEntries.map((stream: any) => {
                      const isSelected = selectedVideoIds.has(stream.id);
                      return (
                        <div 
                          key={stream.id} 
                          onClick={() => toggleVideoSelection(stream.id)}
                          style={{
                            border: isSelected ? '2px solid var(--accent)' : '1px solid transparent',
                            borderRadius: '6px',
                            overflow: 'hidden',
                            cursor: 'pointer',
                            background: isSelected ? 'rgba(139, 92, 246, 0.1)' : 'rgba(255,255,255,0.03)',
                            transition: 'all 0.2s ease',
                            boxShadow: isSelected ? '0 0 10px rgba(139, 92, 246, 0.3)' : 'none',
                            position: 'relative',
                          }}
                        >
                          <img src={stream.thumbnail} alt={stream.title} style={{ width: '100%', height: '75px', objectFit: 'cover' }} />
                          {isSelected && (
                            <div style={{ position: 'absolute', top: '4px', right: '4px', width: '18px', height: '18px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 'bold', color: '#fff' }}>
                              ✓
                            </div>
                          )}
                          <div style={{ padding: '0.4rem', fontSize: '0.7rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: isSelected ? 'var(--text-light)' : 'var(--text-muted)' }}>
                            {stream.title}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {selectedVideoIds.size > 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', alignSelf: 'center' }}>
                        {selectedVideoIds.size} selected
                      </span>
                      <button type="button" className="btn btn-primary btn-sm" onClick={handleAddSelectedVideos} disabled={loading}>
                        Add Selected as VOD ({selectedVideoIds.size})
                      </button>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddAsVodChannel}>
                        Add All as VOD Channel
                      </button>
                    </div>
                  )}
                  {selectedVideoIds.size === 0 && (
                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.75rem', justifyContent: 'flex-end' }}>
                      <button type="button" className="btn btn-secondary btn-sm" onClick={handleAddAsVodChannel}>
                        Add as VOD Channel
                      </button>
                    </div>
                  )}
                </div>
              )}

              {channelStreams.length > 0 && scanTab === 'live' && (
                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                  <label style={{ fontSize: '0.85rem', color: 'var(--text-dark)' }}>Scan Results: Select Stream</label>
                  <div style={{ 
                    display: 'grid', 
                    gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', 
                    gap: '0.75rem', 
                    maxHeight: '180px', 
                    overflowY: 'auto', 
                    border: '1px solid var(--card-border)', 
                    borderRadius: '6px', 
                    padding: '0.75rem', 
                    background: 'rgba(0,0,0,0.15)' 
                  }}>
                    {filteredStreamEntries.map((stream: any) => (
                      <div 
                        key={stream.id} 
                        onClick={() => handleSelectStream(stream)}
                        style={{
                          border: selectedStreamId === stream.id ? '2px solid var(--accent)' : '1px solid transparent',
                          borderRadius: '6px',
                          overflow: 'hidden',
                          cursor: 'pointer',
                          background: 'rgba(255,255,255,0.03)',
                          transition: 'all 0.2s ease',
                          boxShadow: selectedStreamId === stream.id ? '0 0 10px rgba(139, 92, 246, 0.3)' : 'none'
                        }}
                      >
                        <img src={stream.thumbnail} alt={stream.title} style={{ width: '100%', height: '70px', objectFit: 'cover' }} />
                        <div style={{ padding: '0.4rem', fontSize: '0.7rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', color: selectedStreamId === stream.id ? 'var(--text-light)' : 'var(--text-muted)' }}>
                          {stream.title}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {selectedStreamId && scanTab === 'live' && (
                <div className="form-group">
                  <label htmlFor="keyword">Search Keyword (Filters active streams)</label>
                  <input
                    id="keyword"
                    type="text"
                    placeholder="e.g. Makkah, Madinah, Live"
                    value={searchKeyword}
                    onChange={(e) => updateKeywordInUrl(e.target.value)}
                  />
                  <small style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>
                    Keeps your link active forever by searching for this word when the stream restarts.
                  </small>
                </div>
              )}

              <div className="form-group">
                <label htmlFor="name">Channel Name (Optional)</label>
                <input
                  id="name"
                  type="text"
                  placeholder="Leave blank to auto-fetch from YouTube"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category / Group-Title</label>
                <input
                  id="category"
                  type="text"
                  placeholder="e.g. News, Music, Science, Kids"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="logo">Custom Logo URL (Optional)</label>
                <input
                  id="logo"
                  type="url"
                  placeholder="Paste direct link to image"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="checkbox-group">
                <input
                  id="epg"
                  type="checkbox"
                  checked={enableEpg}
                  onChange={(e) => setEnableEpg(e.target.checked)}
                />
                <label htmlFor="epg" style={{ textTransform: 'none', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer' }}>
                  Generate Electronic Program Guide (EPG) listings
                </label>
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Processing...' : 'Save Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isEditModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Edit Channel</h2>
            <form onSubmit={handleEditChannel}>
              <div className="form-group">
                <label htmlFor="url">YouTube URL *</label>
                <input
                  id="url"
                  type="url"
                  required
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="name">Channel Name</label>
                <input
                  id="name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="category">Category / Group-Title</label>
                <input
                  id="category"
                  type="text"
                  required
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="logo">Custom Logo URL (Optional)</label>
                <input
                  id="logo"
                  type="url"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                />
              </div>

              <div className="checkbox-group">
                <input
                  id="epg"
                  type="checkbox"
                  checked={enableEpg}
                  onChange={(e) => setEnableEpg(e.target.checked)}
                />
                <label htmlFor="epg" style={{ textTransform: 'none', fontWeight: '500', fontSize: '0.95rem', cursor: 'pointer' }}>
                  Generate Electronic Program Guide (EPG) listings
                </label>
              </div>

              {error && <p style={{ color: 'var(--danger)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>{error}</p>}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsEditModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Update Channel'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}