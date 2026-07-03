import { useState, useEffect } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { ListVideo, Plus, Search, Edit2, Trash2, Copy, Check, ExternalLink, Play, Radio, FolderHeart, Video } from 'lucide-react';
import { Channel } from '@/utils/db';

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [filteredChannels, setFilteredChannels] = useState<Channel[]>([]);
  
  // Search and Filter
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState<string[]>([]);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [activeChannel, setActiveChannel] = useState<Channel | null>(null);

  // Form State
  const [youtubeUrl, setYoutubeUrl] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [enableEpg, setEnableEpg] = useState(true);

  // Global UI States
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    fetchChannels();
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
        
        // Extract unique categories
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
      const res = await fetch(`/api/channels?id=${id}`, {
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

  const copyStreamLink = (id: string) => {
    const protocol = window.location.protocol;
    const host = window.location.host;
    const playUrl = `${protocol}//${host}/api/play?id=${id}`;
    
    navigator.clipboard.writeText(playUrl);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'live':
        return <Radio size={12} style={{ color: '#ef4444', marginRight: '4px' }} />;
      case 'playlist':
        return <FolderHeart size={12} style={{ color: '#3b82f6', marginRight: '4px' }} />;
      default:
        return <Video size={12} style={{ color: '#10b981', marginRight: '4px' }} />;
    }
  };

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

      {/* Filter and Search Bar */}
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

      {/* Channels Display */}
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
                  onClick={() => copyStreamLink(channel.id)} 
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

      {/* Add Modal */}
      {isAddModalOpen && (
        <div className="modal-overlay">
          <div className="glass-card modal-content">
            <h2 style={{ marginBottom: '1.5rem' }}>Add New Channel</h2>
            <form onSubmit={handleAddChannel}>
              <div className="form-group">
                <label htmlFor="url">YouTube URL *</label>
                <input
                  id="url"
                  type="url"
                  placeholder="https://www.youtube.com/watch?v=... or /playlist?list=..."
                  required
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                />
              </div>

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

      {/* Edit Modal */}
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
