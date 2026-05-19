// src/pages/SocialImportPage.jsx
// Import photos and memories from Facebook & Instagram.
//
// Uses Facebook Graph API to pull:
//   - Photos user was tagged in
//   - Posts mentioning the memorialised person
//   - Shared memories
//
// Route: /memorial/:id/import

import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { useToast } from '../contexts/ToastContext'

// ─── Mock data for demo / dev ─────────────────────────────────────────────────

const MOCK_PHOTOS = [
  { id: 'p1', url: 'https://images.unsplash.com/photo-1518895949257-7621c3c786d7?w=400', caption: 'Family dinner, 2019', date: '2019-12-25', source: 'facebook' },
  { id: 'p2', url: 'https://images.unsplash.com/photo-1529333166437-7750a6dd5a70?w=400', caption: 'Beach holiday', date: '2018-07-14', source: 'facebook' },
  { id: 'p3', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400', caption: 'Birthday celebration', date: '2020-03-21', source: 'instagram' },
  { id: 'p4', url: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=400', caption: 'Sunday lunch', date: '2017-11-05', source: 'facebook' },
  { id: 'p5', url: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=400', caption: 'Graduation day', date: '2016-06-10', source: 'instagram' },
  { id: 'p6', url: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400', caption: 'Wedding anniversary', date: '2019-09-15', source: 'facebook' },
]

const MOCK_MEMORIES = [
  { id: 'm1', text: 'Remember that time we stayed up all night talking about life? I will never forget that conversation.', author: 'Aunt Grace', date: '2018-08-12' },
  { id: 'm2', text: 'The best jollof rice I ever had was at your house. You taught me the secret ingredient.', author: 'Cousin Kofi', date: '2019-01-30' },
  { id: 'm3', text: 'You were the first person who believed in my art. Thank you for everything.', author: 'Friend Sarah', date: '2020-05-22' },
]

// ─── Source card ──────────────────────────────────────────────────────────────

function SourceCard({ source, onConnect, connected, loading }) {
  const icons = { facebook: 'f', instagram: '◉' }
  const names = { facebook: 'Facebook', instagram: 'Instagram' }
  const colors = { facebook: 'from-blue-600 to-blue-800', instagram: 'from-purple-600 to-pink-600' }

  return (
    <div className={`glass rounded-2xl border ${connected ? 'border-gold/30' : 'border-white/10'} p-5 transition-all`}>
      <div className="flex items-center gap-4">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${colors[source]} flex items-center justify-center text-xl font-bold text-white flex-shrink-0`}>
          {icons[source]}
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-white">{names[source]}</h3>
          <p className="text-xs text-white/40 mt-0.5">
            {connected ? 'Connected' : 'Import photos and memories'}
          </p>
        </div>
        <button
          onClick={() => onConnect(source)}
          disabled={connected || loading}
          className={`text-xs font-bold tracking-wider px-4 py-2 rounded-full transition-all ${
            connected
              ? 'bg-gold/20 text-gold border border-gold/30'
              : 'bg-white/5 text-white/60 hover:text-white border border-white/10 hover:border-white/20'
          } disabled:opacity-50`}
        >
          {connected ? 'Connected' : loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}

// ─── Photo grid ───────────────────────────────────────────────────────────────

function PhotoGrid({ photos, selected, onToggle, onImport, importing }) {
  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
        {photos.map(photo => {
          const isSelected = selected.includes(photo.id)
          return (
            <motion.div
              key={photo.id}
              whileTap={{ scale: 0.97 }}
              onClick={() => onToggle(photo.id)}
              className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                isSelected ? 'border-gold' : 'border-transparent hover:border-white/20'
              }`}
            >
              <img src={photo.url} alt={photo.caption} className="w-full h-full object-cover" />
              {isSelected && (
                <div className="absolute top-2 right-2 w-6 h-6 bg-gold rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                <p className="text-[0.55rem] text-white/70 truncate">{photo.caption}</p>
                <p className="text-[0.5rem] text-white/40">{photo.date}</p>
              </div>
            </motion.div>
          )
        })}
      </div>

      {selected.length > 0 && (
        <motion.button
          initial={{ opacity:0, y:8 }}
          animate={{ opacity:1, y:0 }}
          whileTap={{ scale:0.97 }}
          onClick={() => onImport(selected)}
          disabled={importing}
          className="w-full bg-gradient-to-r from-gold to-sky text-black text-xs font-bold tracking-wider py-3 rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {importing ? 'Importing...' : `Import ${selected.length} photo${selected.length > 1 ? 's' : ''} ✦`}
        </motion.button>
      )}
    </div>
  )
}

// ─── Memory card ──────────────────────────────────────────────────────────────

function MemoryCard({ memory, onImport, imported }) {
  return (
    <div className="glass rounded-2xl border border-white/8 p-4">
      <div className="flex gap-3">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold/20 to-coral/20 border border-white/10 flex items-center justify-center text-xs flex-shrink-0">
          ♡
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs text-white/70 leading-relaxed italic">"{memory.text}"</p>
          <div className="flex items-center justify-between mt-2">
            <div>
              <span className="text-[0.6rem] text-white/40">{memory.author}</span>
              <span className="text-[0.5rem] text-white/20 mx-1">·</span>
              <span className="text-[0.6rem] text-white/30">{memory.date}</span>
            </div>
            <button
              onClick={() => onImport(memory)}
              disabled={imported}
              className={`text-[0.55rem] font-bold tracking-wider px-3 py-1 rounded-full transition-all ${
                imported
                  ? 'bg-gold/20 text-gold'
                  : 'bg-white/5 text-white/50 hover:text-white border border-white/10 hover:border-white/20'
              }`}
            >
              {imported ? 'Imported' : 'Add to memorial'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SocialImportPage() {
  const { id: memorialId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { user } = db.useAuth()

  const [connected, setConnected] = useState({ facebook: false, instagram: false })
  const [connecting, setConnecting] = useState(null)
  const [selectedPhotos, setSelectedPhotos] = useState([])
  const [importing, setImporting] = useState(false)
  const [importedMemories, setImportedMemories] = useState([])
  const [activeTab, setActiveTab] = useState('photos')

  const { isLoading, data } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } } } } : null
  )

  if (isLoading) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  const memorial = data?.memorials?.[0]
  if (!memorial) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center px-6 text-center">
        <div>
          <p className="text-white/40 text-sm mb-4">Memorial not found.</p>
          <button onClick={() => navigate(-1)} className="text-xs text-gold hover:text-gold/70 transition-colors">← Back</button>
        </div>
      </div>
    )
  }

  async function handleConnect(source) {
    setConnecting(source)
    // Simulate OAuth flow
    await new Promise(r => setTimeout(r, 1500))
    setConnected(prev => ({ ...prev, [source]: true }))
    setConnecting(null)
    toast.success(`${source === 'facebook' ? 'Facebook' : 'Instagram'} connected ✦`)
  }

  async function handleImportPhotos(photoIds) {
    setImporting(true)
    try {
      const photos = MOCK_PHOTOS.filter(p => photoIds.includes(p.id))
      const txns = photos.map(photo =>
        db.tx.photos[id()].update({
          url: photo.url,
          caption: photo.caption,
          memorialId,
          source: photo.source,
          takenAt: new Date(photo.date).getTime(),
          createdAt: Date.now(),
        })
      )
      await db.transact(txns)
      toast.success(`${photoIds.length} photos imported ✦`)
      setSelectedPhotos([])
    } catch {
      toast.error('Import failed')
    } finally {
      setImporting(false)
    }
  }

  async function handleImportMemory(memory) {
    try {
      await db.transact([
        db.tx.tributes[id()].update({
          type: 'memory',
          text: memory.text,
          authorName: memory.author,
          memorialId,
          createdAt: Date.now(),
        }),
      ])
      setImportedMemories(prev => [...prev, memory.id])
      toast.success('Memory added ✦')
    } catch {
      toast.error('Failed to add memory')
    }
  }

  return (
    <div className="dark-container relative z-10 min-h-screen pb-36">

      {/* Top bar */}
      <div className="flex items-center justify-between px-5 pt-16 pb-4">
        <Link to={`/memorial/${memorialId}`}
          className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="text-center">
          <p className="text-[0.6rem] font-bold tracking-[0.2em] uppercase text-cream-dim">Import</p>
          <p className="text-xs text-white/30 mt-0.5">Social media</p>
        </div>
        <div className="w-9" />
      </div>

      {/* Heading */}
      <div className="px-5 mb-6">
        <h1 className="font-display text-[clamp(1.8rem,5vw,2.4rem)] font-bold leading-tight">
          Import <span className="text-gradient-gold">memories</span>
        </h1>
        <p className="text-sm text-white/40 mt-2 max-w-md leading-relaxed">
          Connect your social accounts to bring photos and memories into this memorial.
        </p>
      </div>

      {/* Source connections */}
      <div className="px-5 space-y-3 mb-8">
        {['facebook', 'instagram'].map(source => (
          <SourceCard
            key={source}
            source={source}
            connected={connected[source]}
            loading={connecting === source}
            onConnect={handleConnect}
          />
        ))}
      </div>

      {/* Content (only show if at least one source connected) */}
      {Object.values(connected).some(Boolean) && (
        <>
          {/* Tabs */}
          <div className="px-5 mb-4">
            <div className="flex gap-2">
              {[
                { id: 'photos', label: 'Photos', count: MOCK_PHOTOS.length },
                { id: 'memories', label: 'Memories', count: MOCK_MEMORIES.length },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-gradient-to-r from-gold/20 to-coral/20 border border-gold/30 text-white'
                      : 'glass border border-white/10 text-white/40 hover:text-white/70'
                  }`}
                >
                  {tab.label} ({tab.count})
                </button>
              ))}
            </div>
          </div>

          {/* Photos tab */}
          {activeTab === 'photos' && (
            <div className="px-5">
              <PhotoGrid
                photos={MOCK_PHOTOS}
                selected={selectedPhotos}
                onToggle={id => setSelectedPhotos(prev =>
                  prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
                )}
                onImport={handleImportPhotos}
                importing={importing}
              />
            </div>
          )}

          {/* Memories tab */}
          {activeTab === 'memories' && (
            <div className="px-5 space-y-3">
              {MOCK_MEMORIES.map(memory => (
                <MemoryCard
                  key={memory.id}
                  memory={memory}
                  imported={importedMemories.includes(memory.id)}
                  onImport={handleImportMemory}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!Object.values(connected).some(Boolean) && (
        <div className="px-5 text-center py-12">
          <div className="text-4xl opacity-10 mb-4">◉</div>
          <p className="text-sm text-white/30">Connect a social account to get started.</p>
          <p className="text-xs text-white/20 mt-1">Photos and memories will appear here.</p>
        </div>
      )}

    </div>
  )
}
