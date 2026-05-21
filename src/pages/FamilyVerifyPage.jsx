// src/pages/FamilyVerifyPage.jsx
// Route: /connect/family/verify/:token?action=approve|reject
// Memorial owner opens this page from their email link.
// Shows: claimant info, claimed relation.
// Owner can: approve, reject, or change the relationship before approving.

import { useState, useEffect } from 'react'
import { useParams, useSearchParams, Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { db } from '../lib/instant'
import RelationPicker from '../components/ui/RelationPicker'
import { getRelationLabel } from '../lib/relations'

export default function FamilyVerifyPage() {
  const { token }     = useParams()
  const [searchParams] = useSearchParams()
  const navigate       = useNavigate()
  const { user }       = db.useAuth()

  const actionFromUrl = searchParams.get('action')   // 'approve' | 'reject'

  const [connection, setConnection] = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [step,       setStep]       = useState('review')   // 'review' | 'change-relation' | 'done' | 'error'
  const [relation,   setRelation]   = useState('')
  const [processing, setProcessing] = useState(false)
  const [error,      setError]      = useState('')
  const [outcome,    setOutcome]    = useState('')   // 'approved' | 'rejected' | 'suggested'

  // Fetch the connection by token
  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return }
    db.queryOnce({
      familyConnections: { $: { where: { verifyToken: token } } },
    }).then(({ data }) => {
      const conn = data?.familyConnections?.[0]
      if (!conn) { setError('This link has expired or is invalid.'); setLoading(false); return }
      if (conn.status !== 'pending') {
        setOutcome(conn.status)
        setStep('done')
        setLoading(false)
        return
      }
      setConnection(conn)
      setRelation(conn.relation)
      setLoading(false)

      // Auto-act if action param provided in URL
      if (actionFromUrl === 'reject') handleReject(conn)
    }).catch(() => {
      setError('Could not load this request. Try again.')
      setLoading(false)
    })
  }, [token, actionFromUrl])

  // Approve outright — keeps the relation the inviter chose (or auto-confirms
  // the owner's suggestion if they approved from the change-relation step).
  async function handleApprove() {
    if (!connection) return
    setProcessing(true)
    try {
      const finalRelation = relation || connection.relation
      await db.transact([
        db.tx.familyConnections[connection.id].update({
          status:            'approved',
          relation:          finalRelation,
          suggestedRelation: null,
          approvedAt:        Date.now(),
        }),
      ])
      // Notify the claimant by email
      fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:       'family-connection-approved',
          claimerEmail: connection.fromEmail,
          claimerName:  connection.fromName,
          relation:     finalRelation,
          ownerName:    user?.email?.split('@')[0] || 'the family',
        }),
      }).catch(() => {})
      setOutcome('approved')
      setStep('done')
    } catch {
      setError('Could not update the request. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  // Suggest a different relation — sets suggestedRelation, status STAYS
  // 'pending', and the claimant must confirm/decline on their end.
  async function handleSuggest() {
    if (!connection || !relation || relation === connection.relation) return
    setProcessing(true)
    try {
      await db.transact([
        db.tx.familyConnections[connection.id].update({
          status:            'pending',
          suggestedRelation: relation,
          suggestedAt:       Date.now(),
        }),
      ])
      // Email the inviter so they can confirm the new relation
      fetch('/api/email', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          action:             'family-connection-suggested',
          claimerEmail:       connection.fromEmail,
          claimerName:        connection.fromName,
          originalRelation:   connection.relation,
          suggestedRelation:  relation,
          ownerName:          user?.email?.split('@')[0] || 'the family',
        }),
      }).catch(() => {})
      setOutcome('suggested')
      setStep('done')
    } catch {
      setError('Could not save the suggestion. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  async function handleReject(conn = connection) {
    const target = conn || connection
    if (!target) return
    setProcessing(true)
    try {
      await db.transact([
        db.tx.familyConnections[target.id].update({
          status:     'rejected',
          approvedAt: Date.now(),
        }),
      ])
      setOutcome('rejected')
      setStep('done')
    } catch {
      setError('Could not update the request. Please try again.')
    } finally {
      setProcessing(false)
    }
  }

  if (loading) {
    return (
      <div className="relative z-10 min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !connection) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <div className="text-4xl mb-4">⚠</div>
        <h1 className="font-display text-xl font-bold text-white mb-3">Link not found</h1>
        <p className="text-sm text-white/50 mb-6">{error}</p>
        <Link to="/" className="text-xs text-gold hover:text-gold/70">← Home</Link>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-6 py-20">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm"
      >

        <div className="text-center mb-8">
          <Link to="/" className="text-brand text-2xl font-display font-bold block mb-1">WHO WAS I</Link>
          <p className="text-[0.6rem] tracking-[0.28em] uppercase text-white/30">Family Verification</p>
        </div>

        <AnimatePresence mode="wait">

          {/* ── Review step ───────────────────────────────────────────────── */}
          {step === 'review' && connection && (
            <motion.div key="review" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="space-y-5">

              <div className="glass border border-white/10 rounded-3xl p-6 text-center">
                {/* Claimant avatar */}
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-gold/20 to-sky/20 border border-white/10 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-4">
                  {connection.fromName?.[0]?.toUpperCase() || '?'}
                </div>

                <h2 className="font-display text-xl font-bold text-white mb-1">
                  {connection.fromName || 'Someone'}
                </h2>
                <p className="text-xs text-white/40 mb-4">{connection.fromEmail}</p>

                <div className="glass border border-gold/15 rounded-2xl px-5 py-3 inline-block">
                  <p className="text-xs text-white/40 mb-1">Claims to be your</p>
                  <p className="font-display text-lg font-bold text-gold">
                    {getRelationLabel(connection.relation) || connection.relation}
                  </p>
                </div>
              </div>

              <p className="text-xs text-white/40 text-center leading-relaxed">
                Approving adds them to your family circle. They can then leave tributes, view the Life Reel, and access family features. You can remove them at any time.
              </p>

              {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

              {/* Actions */}
              <button
                onClick={handleApprove}
                disabled={processing}
                className="w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn disabled:opacity-50"
              >
                {processing ? 'Updating…' : '✓  Approve — add to family circle'}
              </button>

              <button
                onClick={() => setStep('change-relation')}
                className="w-full py-3 rounded-2xl text-xs font-semibold glass border border-white/10 text-white/60 hover:text-white hover:border-white/20 transition-all"
              >
                ✎  Suggest a different relationship
              </button>

              <button
                onClick={() => handleReject()}
                disabled={processing}
                className="w-full py-3 text-xs text-white/30 hover:text-rose-400 transition-colors"
              >
                ✕  Decline this request
              </button>
            </motion.div>
          )}

          {/* ── Suggest a different relationship ──────────────────────────── */}
          {step === 'change-relation' && (
            <motion.div key="change-rel" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="space-y-5">
              <div className="text-center">
                <h2 className="font-display text-xl font-bold text-white mb-2">Suggest a different relationship</h2>
                <p className="text-sm text-white/50">
                  {connection?.fromName} said they are your <strong className="text-white">{getRelationLabel(connection?.relation)}</strong>.
                  Pick what you think is correct — they'll need to confirm before being added.
                </p>
              </div>
              <RelationPicker value={relation} onChange={setRelation} />
              <button onClick={handleSuggest}
                disabled={processing || !relation || relation === connection?.relation}
                className="w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn disabled:opacity-50">
                {processing
                  ? 'Sending…'
                  : `Send "${getRelationLabel(relation) || 'family'}" for them to confirm →`}
              </button>
              <p className="text-[0.65rem] text-white/30 text-center leading-relaxed">
                If they agree, they'll be added automatically. If they decline,
                you'll be notified and the request stays open.
              </p>
              <button onClick={() => setStep('review')}
                className="w-full py-3 text-xs text-white/30 hover:text-white/50 transition-colors">
                ← Back
              </button>
            </motion.div>
          )}

          {/* ── Done ─────────────────────────────────────────────────────── */}
          {step === 'done' && (
            <motion.div key="done" initial={{ opacity:0, scale:.96 }} animate={{ opacity:1, scale:1 }}
              className="text-center space-y-5">
              <div className="text-5xl">
                {outcome === 'approved' ? '✦' : outcome === 'suggested' ? '✎' : '◎'}
              </div>
              <h1 className="font-display text-2xl font-bold text-white">
                {outcome === 'approved'  ? 'Connection approved'
                 : outcome === 'suggested' ? 'Suggestion sent'
                 : 'Request declined'}
              </h1>
              <p className="text-sm text-white/55 leading-relaxed">
                {outcome === 'approved'
                  ? `${connection?.fromName || 'They'} has been added to your family circle. They'll receive a confirmation by email.`
                  : outcome === 'suggested'
                    ? `We've sent ${connection?.fromName || 'them'} your suggested relationship. They'll need to confirm before being added. You'll get a notification when they respond.`
                    : 'The request has been declined. No data has been shared.'}
              </p>
              <Link to="/family-tree"
                className="block w-full py-4 rounded-2xl text-sm font-bold text-black metal-btn text-center">
                View family tree →
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
