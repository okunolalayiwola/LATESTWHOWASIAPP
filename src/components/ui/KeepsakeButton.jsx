// src/components/ui/KeepsakeButton.jsx
// Downloads the server-generated keepsake PDF for a memorial.
// Drop into MemorialDetailPage (e.g. in the actions row) and ProfilePage.

import { useState } from 'react'
import { motion } from 'framer-motion'

export default function KeepsakeButton({ memorialId, memorialName, variant = 'full' }) {
  const [state, setState] = useState('idle')  // idle | working | done | error

  async function download() {
    if (state === 'working') return
    setState('working')
    try {
      const res = await fetch(`/api/memorial-pdf?id=${encodeURIComponent(memorialId)}`)
      if (!res.ok) throw new Error('Generation failed')
      const blob = await res.blob()
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `${(memorialName || 'memorial').replace(/[^a-z0-9]/gi, '-')}-keepsake.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
      setState('done')
      setTimeout(() => setState('idle'), 3000)
    } catch {
      setState('error')
      setTimeout(() => setState('idle'), 3500)
    }
  }

  const label = {
    idle:    'Download keepsake PDF',
    working: 'Composing booklet…',
    done:    'Saved ✓',
    error:   'Try again',
  }[state]

  if (variant === 'compact') {
    return (
      <button onClick={download} disabled={state === 'working'}
        className="flex items-center gap-2 rubber-btn px-4 py-2.5 rounded-full text-sm text-white/60 hover:text-white transition-colors disabled:opacity-60">
        <span>{state === 'working' ? '◌' : '📖'}</span>
        <span>{label}</span>
      </button>
    )
  }

  return (
    <motion.button
      onClick={download}
      disabled={state === 'working'}
      whileTap={{ scale: 0.98 }}
      className="w-full py-4 rounded-2xl text-sm font-bold tracking-[0.14em] uppercase disabled:opacity-70 flex items-center justify-center gap-2"
      style={{
        background: state === 'error'
          ? 'rgba(251,113,133,0.15)'
          : 'linear-gradient(135deg, rgba(255,215,0,0.18), rgba(192,132,252,0.16), rgba(56,189,248,0.14))',
        border: '1px solid rgba(255,255,255,0.14)',
        color: state === 'error' ? '#FB7185' : '#fff',
      }}
    >
      {state === 'working' && (
        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
      )}
      {state !== 'working' && <span>📖</span>}
      <span>{label}</span>
    </motion.button>
  )
}
