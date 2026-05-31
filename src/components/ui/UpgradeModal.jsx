// src/components/ui/UpgradeModal.jsx
// The "subscribe" cutoff shown when a user tries to use a feature their plan
// doesn't include. Driven by PaywallContext — it knows which feature was
// blocked, looks up the lowest plan that unlocks it, and routes to /premium.

import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { requiredPlanFor, FEATURE_COPY, PLANS, CURRENCY } from '../../lib/plans'

export default function UpgradeModal({ gate, onClose }) {
  const navigate = useNavigate()
  const open    = !!gate
  const feature = gate?.feature
  const planId  = feature ? requiredPlanFor(feature) : 'premium'
  const meta    = PLANS[planId]
  const copy    = (feature && FEATURE_COPY[feature]) || {
    title: 'Unlock more',
    body:  'Upgrade your plan to use this feature.',
  }

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={onClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(8,8,15,0.82)', backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-md"
            style={{
              background: 'linear-gradient(180deg, rgba(243,178,26,0.10), rgba(20,20,28,0.96))',
              border: '1px solid rgba(243,178,26,0.22)',
              borderRadius: '26px 26px 0 0',
              padding: '26px 24px max(28px, env(safe-area-inset-bottom))',
              boxShadow: '0 -20px 60px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="text-[0.6rem] font-bold tracking-[0.2em] uppercase"
                style={{ color: '#f3b21a' }}>
                {meta.emoji} {meta.name} plan
              </span>
              <button onClick={onClose} aria-label="Close"
                className="w-8 h-8 rounded-full flex items-center justify-center text-white/40 hover:text-white"
                style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                ✕
              </button>
            </div>

            <h2 className="font-display text-2xl font-bold text-white mb-1.5">{copy.title}</h2>
            <p className="text-sm text-white/55 leading-relaxed mb-5">{copy.body}</p>

            <ul className="space-y-2 mb-6">
              {meta.features.slice(0, 4).map((f, i) => (
                <li key={i} className="flex items-start gap-2.5 text-xs text-white/65">
                  <span style={{ color: '#f3b21a' }} className="mt-0.5">✦</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={() => { onClose(); navigate(`/premium?plan=${planId}`) }}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-black mb-2.5"
              style={{ background: 'linear-gradient(90deg, #f3b21a, #ff6b4d)' }}>
              Subscribe — {meta.name}{meta.price ? ` · ${CURRENCY}${meta.price}${meta.period}` : ''}
            </button>
            <button onClick={onClose}
              className="w-full py-2.5 rounded-xl text-xs font-semibold text-white/45 hover:text-white/70 transition-colors">
              Not now
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  )
}
