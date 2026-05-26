// src/components/members/SearchModal.jsx
// Keyboard-driven search overlay for family members.
// Filter by living / deceased. Arrow keys + Enter to navigate.

import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

const FILTERS = ['All', 'Living', 'Deceased']

export default function SearchModal({ members, onSelect, onClose }) {
  const [query,  setQuery]  = useState('')
  const [filter, setFilter] = useState('All')
  const [cursor, setCursor] = useState(0)
  const inputRef = useRef()

  useEffect(() => { inputRef.current?.focus() }, [])

  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  const results = members.filter(m => {
    const q    = query.toLowerCase()
    const name = m.name?.toLowerCase().includes(q)
    const rel  = m.relation?.toLowerCase().includes(q)
    const status =
      filter === 'All'      ? true :
      filter === 'Living'   ? m.alive :
      filter === 'Deceased' ? !m.alive : true
    return (name || rel) && status
  })

  function handleKey(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setCursor(c => Math.min(c + 1, results.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)) }
    if (e.key === 'Enter' && results[cursor]) { onSelect(results[cursor]) }
  }

  const dotCls = alive =>
    alive ? 'bg-emerald-400' : 'bg-amber-400'

  const avatarCls = alive =>
    alive
      ? 'bg-emerald-900/40 border-emerald-700/30 text-emerald-300'
      : 'bg-amber-900/30  border-amber-700/20  text-amber-300'

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/70 z-40 backdrop-blur-sm"
      />

      {/* Modal */}
      <motion.div
        initial={{ opacity: 0, y: -20, scale: 0.97 }}
        animate={{ opacity: 1, y: 0,   scale: 1    }}
        exit={{ opacity: 0, y: -20, scale: 0.97 }}
        transition={{ type: 'spring', damping: 28, stiffness: 300 }}
        className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-4"
      >
        <div className="bg-[#0d0d0d] border border-white/10 rounded-2xl overflow-hidden">

          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-white/5">
            <svg className="w-4 h-4 text-white/30 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
            </svg>
            <input
              ref={inputRef}
              value={query}
              onChange={e => { setQuery(e.target.value); setCursor(0) }}
              onKeyDown={handleKey}
              placeholder="Search by name or relation..."
              className="flex-1 bg-transparent text-sm text-white placeholder-white/25 outline-none"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-white/30 hover:text-white transition-colors">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>

          {/* Filter pills */}
          <div className="flex gap-1.5 px-4 py-2.5 border-b border-white/5">
            {FILTERS.map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-[0.6rem] font-bold tracking-widest uppercase px-3 py-1.5 rounded-full transition-all ${
                  filter === f
                    ? 'bg-gradient-to-r from-gold to-sky text-black'
                    : 'text-white/40 hover:text-white hover:bg-white/5'
                }`}
              >
                {f}
              </button>
            ))}
            <span className="ml-auto text-[0.6rem] text-white/20 self-center">
              {results.length} found
            </span>
          </div>

          {/* Results */}
          <div className="max-h-72 overflow-y-auto">
            {results.length === 0 ? (
              <div className="py-10 text-center text-white/30 text-sm">
                No members found
              </div>
            ) : (
              results.map((m, i) => (
                <button
                  key={m.id}
                  onClick={() => onSelect(m)}
                  onMouseEnter={() => setCursor(i)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors border-b border-white/5 last:border-0 ${
                    i === cursor ? 'bg-white/[0.05]' : 'hover:bg-white/[0.03]'
                  }`}
                >
                  <div className={`w-9 h-9 rounded-full border flex-shrink-0 flex items-center justify-center text-xs font-bold overflow-hidden ${avatarCls(m.alive)}`}>
                    {m.photo
                      ? <img loading="lazy" decoding="async" src={m.photo} alt="" className="w-full h-full object-cover" />
                      : (m.avatar || m.name?.slice(0, 2).toUpperCase() || '?')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white truncate">{m.name}</div>
                    <div className="text-[0.65rem] text-white/40 uppercase tracking-wider">
                      {m.relation} {m.born ? `· ${m.born}` : ''}
                      {!m.alive && m.died ? ` — ${m.died}` : ''}
                    </div>
                  </div>
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotCls(m.alive)}`} />
                </button>
              ))
            )}
          </div>

          {/* Hint */}
          <div className="px-4 py-2 border-t border-white/5 flex gap-4 text-[0.55rem] text-white/20 tracking-widest uppercase">
            <span>↑↓ Navigate</span>
            <span>↵ Select</span>
            <span>Esc Close</span>
          </div>
        </div>
      </motion.div>
    </>
  )
}
