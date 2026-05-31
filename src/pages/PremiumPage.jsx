// src/pages/PremiumPage.jsx
// Subscription page. Three tiers — Free, Premium, Family — sourced from the
// single entitlements definition in lib/plans.js.
//
// Route: /premium   (optionally /premium?plan=premium to pre-select a tier)

import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { db } from '../lib/instant'
import { useToast } from '../contexts/ToastContext'
import { PLAN_LIST, CURRENCY, normalizePlan } from '../lib/plans'

// Side-by-side comparison (free · premium · family)
const COMPARE = [
  { label: 'Memorials',                 free: '1',        premium: 'Unlimited', family: 'Unlimited' },
  { label: 'Photo gallery',             free: '8 photos', premium: 'Unlimited', family: 'Unlimited' },
  { label: 'Legacy Letters',            free: '1',        premium: 'Unlimited', family: 'Unlimited' },
  { label: 'Voice memory capture',      free: '—',        premium: '✓',         family: '✓' },
  { label: 'Living voice conversation', free: '—',        premium: '✓',         family: '✓' },
  { label: 'Legacy Vault (will & docs)',free: '—',        premium: '✓',         family: '✓' },
  { label: 'Family Circle & sharing',   free: '—',        premium: '—',         family: '✓' },
  { label: 'Family tree',               free: '—',        premium: '—',         family: '✓' },
  { label: 'Support',                   free: 'Standard', premium: 'Priority',  family: 'Dedicated' },
]

export default function PremiumPage() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const { toast } = useToast()
  const { user } = db.useAuth()

  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null,
  )
  const profile = data?.profiles?.[0]
  const currentPlan = normalizePlan(profile?.plan)

  const preselect = ['free', 'premium', 'family'].includes(params.get('plan')) ? params.get('plan') : 'premium'
  const [selectedPlan, setSelectedPlan] = useState(preselect)
  const [loading, setLoading] = useState(false)

  async function handleSubscribe(planId) {
    if (planId === currentPlan) { toast.info('This is your current plan'); return }
    if (!profile) { navigate('/auth'); return }
    setLoading(true)
    try {
      // NOTE: payment is not yet wired to Stripe Checkout — this sets the plan
      // directly. Swap for a Checkout session when billing goes live.
      await db.transact([
        db.tx.profiles[profile.id].update({ plan: planId }),
      ])
      toast.success(
        planId === 'free' ? 'Switched to the Free plan'
          : `You're on ${planId.charAt(0).toUpperCase() + planId.slice(1)} ${planId === 'family' ? '♡' : '✦'}`,
      )
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="dark-container relative z-10 min-h-screen pb-36">

      {/* Back */}
      <div className="px-5 pt-16 pb-4">
        <button onClick={() => navigate(-1)}
          className="w-9 h-9 glass rounded-full flex items-center justify-center text-white/60 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      {/* Header */}
      <div className="px-5 mb-8 text-center">
        <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ duration:0.5 }}>
          <div className="text-3xl mb-3 opacity-30">✦</div>
          <h1 className="font-display text-[clamp(2rem,6vw,3.2rem)] font-bold leading-tight mb-3">
            Honour them <span className="text-gradient-gold">fully</span>
          </h1>
          <p className="text-sm text-white/45 max-w-md mx-auto leading-relaxed">
            Every memorial is free to create. Premium keeps their voice alive; Family brings
            everyone who loved them together.
          </p>
          <p className="text-[0.6rem] text-white/25 mt-3">You're currently on the {PLAN_LIST.find(p => p.id === currentPlan)?.name} plan.</p>
        </motion.div>
      </div>

      {/* Plan cards */}
      <div className="px-5 grid grid-cols-1 md:grid-cols-3 gap-4 mb-10 max-w-5xl mx-auto">
        {PLAN_LIST.map((plan, i) => {
          const isCurrent = currentPlan === plan.id
          return (
            <motion.div key={plan.id}
              initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }} transition={{ delay: i * 0.1 }}
              onClick={() => setSelectedPlan(plan.id)}
              className={`relative rounded-2xl p-6 transition-all cursor-pointer ${
                plan.highlighted
                  ? 'bg-gradient-to-b from-gold/10 to-coral/5 border border-gold/30 shadow-lg shadow-gold/10'
                  : 'glass border border-white/10'
              } ${selectedPlan === plan.id ? 'ring-2 ring-gold/50' : ''}`}>
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-gold to-sky text-black text-[0.5rem] font-bold tracking-widest uppercase px-3 py-1 rounded-full">
                  Most popular
                </div>
              )}

              <div className="text-2xl mb-3">{plan.emoji}</div>
              <h3 className="font-display text-xl font-bold text-white mb-0.5">{plan.name}</h3>
              <p className="text-[0.7rem] text-white/40 mb-3">{plan.tagline}</p>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-white">
                  {plan.price === 0 ? 'Free' : `${CURRENCY}${plan.price}`}
                </span>
                {plan.price > 0 && <span className="text-sm text-white/40">{plan.period}</span>}
              </div>

              <ul className="space-y-2 mb-6">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-start gap-2 text-xs text-white/60">
                    <span className="text-gold/60 mt-0.5">✦</span>
                    {f}
                  </li>
                ))}
              </ul>

              <button
                onClick={(e) => { e.stopPropagation(); handleSubscribe(plan.id) }}
                disabled={isCurrent || loading}
                className={`w-full py-3 rounded-xl text-xs font-bold tracking-wider transition-all ${
                  isCurrent
                    ? 'bg-white/5 text-white/30 border border-white/10 cursor-default'
                    : plan.highlighted
                      ? 'bg-gradient-to-r from-gold to-sky text-black hover:opacity-90'
                      : 'glass border border-white/10 text-white/60 hover:text-white hover:border-white/20'
                } disabled:opacity-50`}>
                {isCurrent ? 'Current plan' : loading ? 'Processing…' : plan.cta}
              </button>
            </motion.div>
          )
        })}
      </div>

      {/* Feature comparison */}
      <div className="px-5 max-w-2xl mx-auto">
        <h2 className="font-display text-xl font-bold text-white text-center mb-6">Compare plans</h2>
        <div className="glass rounded-2xl border border-white/10 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="text-left px-4 py-3 text-[0.6rem] font-bold tracking-widest uppercase text-white/30">Feature</th>
                <th className="px-3 py-3 text-[0.6rem] font-bold tracking-widest uppercase text-white/30 text-center">Free</th>
                <th className="px-3 py-3 text-[0.6rem] font-bold tracking-widest uppercase text-gold/60 text-center">Premium</th>
                <th className="px-3 py-3 text-[0.6rem] font-bold tracking-widest uppercase text-white/30 text-center">Family</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map((row, i) => (
                <tr key={i} className="border-b border-white/5 last:border-0">
                  <td className="px-4 py-3 text-xs text-white/70">{row.label}</td>
                  <td className="px-3 py-3 text-xs text-white/40 text-center">{row.free}</td>
                  <td className="px-3 py-3 text-xs text-gold/70 text-center font-medium">{row.premium}</td>
                  <td className="px-3 py-3 text-xs text-white/60 text-center">{row.family}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* FAQ */}
      <div className="px-5 max-w-2xl mx-auto mt-10">
        <h2 className="font-display text-xl font-bold text-white text-center mb-6">Questions</h2>
        <div className="space-y-3">
          {[
            { q: 'Can I cancel anytime?', a: 'Yes. You can downgrade or cancel at any time from Settings. Your memorials remain accessible.' },
            { q: 'What happens to voice memories if I downgrade?', a: 'Existing voice memories remain playable, but you cannot capture new voices on the Free plan.' },
            { q: "What's the difference between Premium and Family?", a: 'Premium gives one person every remembrance feature — unlimited memorials, voice capture, and conversation. Family adds collaboration: invite relatives, share the Vault, and build a family tree together.' },
            { q: 'Is my data private?', a: 'Absolutely. Memorials have privacy controls (public, family-only, private). We never share your data.' },
          ].map((faq, i) => (
            <details key={i} className="glass rounded-2xl border border-white/10 group">
              <summary className="px-4 py-3.5 text-sm text-white/70 font-medium cursor-pointer hover:text-white transition-colors list-none flex items-center justify-between">
                {faq.q}
                <svg className="w-3 h-3 text-white/30 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </summary>
              <div className="px-4 pb-4 text-xs text-white/40 leading-relaxed">{faq.a}</div>
            </details>
          ))}
        </div>
      </div>

    </div>
  )
}
