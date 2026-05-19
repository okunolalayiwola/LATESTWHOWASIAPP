// src/components/ui/EmptyState.jsx
// One reusable, premium empty state. Replaces every "Nothing here" message.
// An empty state should TEACH: what this is for + one clear next action.
//
// Usage:
//   <EmptyState
//     icon="✦"
//     title="No memorials yet"
//     body="A memorial keeps someone's voice, story and photos alive — start with one person you love."
//     actionLabel="Create your first memorial"
//     to="/create"                       // OR onClick={fn}
//     accent="#FFD700"
//   />

import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function EmptyState({
  icon = '◎',
  title,
  body,
  actionLabel,
  to,
  onClick,
  secondaryLabel,
  onSecondary,
  accent = '#FFD700',
  compact = false,
}) {
  const Action = () => {
    if (!actionLabel) return null
    const cls =
      'inline-flex items-center gap-2 metal-btn text-black text-sm font-bold px-6 py-3 rounded-full'
    if (to) return <Link to={to} className={cls}>{actionLabel}</Link>
    return <button onClick={onClick} className={cls}>{actionLabel}</button>
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className={`text-center mx-auto ${compact ? 'py-10' : 'py-16'}`}
      style={{ maxWidth: 380 }}
    >
      {/* Halo + glyph */}
      <div className="relative inline-flex items-center justify-center mb-5">
        <div
          className="absolute rounded-full"
          style={{
            width: 96, height: 96,
            background: `radial-gradient(circle, ${accent}1f, transparent 70%)`,
            filter: 'blur(8px)',
          }}
        />
        <div
          className="relative w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
          style={{
            background: `linear-gradient(150deg, ${accent}18, rgba(255,255,255,0.03))`,
            border: `1px solid ${accent}30`,
            boxShadow: `0 8px 24px rgba(0,0,0,0.35), 0 0 32px ${accent}14`,
          }}
        >
          {icon}
        </div>
      </div>

      {title && (
        <h3 className="font-display text-xl font-bold text-white mb-2">{title}</h3>
      )}
      {body && (
        <p className="text-sm text-white/45 leading-relaxed mb-7 px-2">{body}</p>
      )}

      <Action />

      {secondaryLabel && (
        <div className="mt-3">
          <button
            onClick={onSecondary}
            className="text-xs text-white/35 hover:text-white/60 transition-colors underline underline-offset-4"
          >
            {secondaryLabel}
          </button>
        </div>
      )}
    </motion.div>
  )
}
