// src/components/ui/RelationPicker.jsx
// Structured bottom-sheet picker. Enforces canonical values — no free text.
// Shows misspelling warning if someone typed something close but wrong.
// Call this wherever a relation is needed (CreateMemorialPage, EditMemorialPage).

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { RELATION_GROUPS, getRelationLabel, normalizeRelation } from '../../lib/relations'

const RING_LABEL = { 1: 'Immediate', 2: 'Parents & Relatives', 3: 'Extended' }
const RING_COLOR = { 1: '#4aaa4a', 2: '#38BDF8', 3: '#FFD700' }

export default function RelationPicker({ value, onChange, onClose, error }) {
  const [search,     setSearch]     = useState('')
  const [openGroup,  setOpenGroup]  = useState(null)
  const [freeText,   setFreeText]   = useState('')
  const [freeError,  setFreeError]  = useState('')
  const [freeSuggestion, setFreeSuggestion] = useState(null)
  const [mode,       setMode]       = useState('browse')   // 'browse' | 'type'

  const filtered = search
    ? RELATION_GROUPS.map(g => ({
        ...g,
        relations: g.relations.filter(r =>
          r.label.toLowerCase().includes(search.toLowerCase())
        )
      })).filter(g => g.relations.length > 0)
    : RELATION_GROUPS

  function select(relValue) {
    onChange(relValue)
    onClose()
  }

  function handleFreeTextSubmit() {
    if (!freeText.trim()) return
    const result = normalizeRelation(freeText.trim())

    if (!result) {
      setFreeError(`"${freeText}" isn't recognised. Try searching in the list below, or check spelling.`)
      setFreeSuggestion(null)
      return
    }

    if (result.confidence === 'fuzzy') {
      setFreeSuggestion(result)
      setFreeError('')
      return
    }

    // Exact or alias match
    select(result.value)
  }

  function acceptSuggestion() {
    if (freeSuggestion) {
      select(freeSuggestion.value)
    }
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40" />

      <motion.div
        initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
        transition={{ type:'spring', damping:30, stiffness:300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0d10] rounded-t-3xl max-h-[88vh] flex flex-col"
        style={{ borderTop:'1px solid rgba(255,255,255,0.10)' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-3 flex-shrink-0" />

        {/* Header */}
        <div className="px-5 pb-3 flex-shrink-0">
          <h3 className="font-display text-xl font-bold text-white">How are they related to you?</h3>
          <p className="text-xs text-white/40 mt-1">
            Select from the list — this places them correctly in your family tree.
          </p>

          {/* Mode toggle */}
          <div className="flex gap-1 mt-3 mb-2 bg-white/[0.04] rounded-xl p-1">
            {[{ id:'browse', l:'Browse categories' }, { id:'type', l:'Type a relation' }].map(m => (
              <button key={m.id} onClick={() => { setMode(m.id); setFreeText(''); setFreeError(''); setFreeSuggestion(null) }}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${mode===m.id ? 'metal-btn text-black' : 'text-white/40 hover:text-white/70'}`}>
                {m.l}
              </button>
            ))}
          </div>

          {/* Error banner */}
          {error && (
            <div className="flex items-start gap-2 bg-rose/10 border border-rose/20 rounded-xl px-3 py-2.5 mb-2">
              <span className="text-rose text-xs mt-0.5 flex-shrink-0">⚠</span>
              <p className="text-xs text-rose/80 leading-relaxed">{error}</p>
            </div>
          )}

          {/* Type mode: free text with normalization */}
          {mode === 'type' && (
            <div className="mt-2 mb-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={freeText}
                  onChange={e => { setFreeText(e.target.value); setFreeError(''); setFreeSuggestion(null) }}
                  onKeyDown={e => e.key === 'Enter' && handleFreeTextSubmit()}
                  placeholder="e.g. mum, dad, gran, uncle…"
                  className="flex-1 inset-field rounded-xl px-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none"
                  autoFocus
                />
                <button onClick={handleFreeTextSubmit}
                  className="metal-btn text-black text-xs font-bold px-4 rounded-xl">
                  Match
                </button>
              </div>

              {/* Misspelling / fuzzy suggestion */}
              {freeSuggestion && (
                <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                  className="mt-2 flex items-center justify-between bg-gold/8 border border-gold/20 rounded-xl px-4 py-3">
                  <div>
                    <p className="text-xs text-gold/80 font-semibold">Did you mean "{freeSuggestion.label}"?</p>
                    <p className="text-[0.6rem] text-white/35 mt-0.5">
                      Ring {freeSuggestion.ring} · {freeSuggestion.group}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setFreeSuggestion(null); setFreeText('') }}
                      className="text-xs text-white/30 hover:text-white/60 px-2 py-1">No</button>
                    <button onClick={acceptSuggestion}
                      className="metal-btn text-black text-xs font-bold px-3 py-1.5 rounded-full">
                      Yes ✓
                    </button>
                  </div>
                </motion.div>
              )}

              {/* Error */}
              {freeError && (
                <motion.div initial={{ opacity:0, y:-4 }} animate={{ opacity:1, y:0 }}
                  className="mt-2 flex items-start gap-2 bg-rose/8 border border-rose/20 rounded-xl px-3 py-2.5">
                  <span className="text-rose text-xs mt-0.5 flex-shrink-0">✕</span>
                  <p className="text-xs text-rose/75 leading-relaxed">{freeError}</p>
                </motion.div>
              )}

              <p className="text-[0.6rem] text-white/20 mt-2 text-center">
                Or browse the list below to select ↓
              </p>
            </div>
          )}

          {/* Browse mode: search field */}
          {mode === 'browse' && (
            <div className="relative mt-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />
              </svg>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search: e.g. uncle, wife, cousin…"
                className="w-full inset-field rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none" />
            </div>
          )}

          {/* Ring legend */}
          <div className="flex gap-4 mt-2.5">
            {[1,2,3].map(r => (
              <div key={r} className="flex items-center gap-1.5 text-[0.58rem] text-white/30">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: RING_COLOR[r] }} />
                <span>{RING_LABEL[r]}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="sharp-divider flex-shrink-0" />

        {/* Groups list */}
        <div className="overflow-y-auto px-5 py-2 pb-10 scrollbar-hide flex-1">
          {filtered.length === 0 && (
            <div className="text-center py-10">
              <p className="text-white/30 text-sm">No relations match that search.</p>
              <p className="text-white/20 text-xs mt-1">Try switching to "Type a relation" above.</p>
            </div>
          )}

          {filtered.map(group => (
            <div key={group.group} className="mb-1">
              {/* Group header */}
              <button
                onClick={() => setOpenGroup(openGroup === group.group ? null : group.group)}
                className="w-full flex items-center justify-between py-3 text-left"
              >
                <div className="flex items-center gap-2.5">
                  <span className="text-base">{group.icon}</span>
                  <span className="text-sm font-semibold text-white">{group.group}</span>
                  <span className="text-[0.55rem] px-2 py-0.5 rounded-full font-bold"
                    style={{ background: `${RING_COLOR[group.ring]}15`, color: RING_COLOR[group.ring], border: `1px solid ${RING_COLOR[group.ring]}30` }}>
                    Ring {group.ring}
                  </span>
                </div>
                <svg className={`w-4 h-4 text-white/25 transition-transform ${(openGroup === group.group || !!search) ? 'rotate-180' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {/* Relations grid */}
              <AnimatePresence>
                {(openGroup === group.group || !!search) && (
                  <motion.div initial={{ height:0,opacity:0 }} animate={{ height:'auto',opacity:1 }}
                    exit={{ height:0,opacity:0 }} className="overflow-hidden">
                    <div className="grid grid-cols-2 gap-2 pb-3">
                      {group.relations.map(rel => {
                        const isSelected = value === rel.value
                        return (
                          <button key={rel.value} onClick={() => select(rel.value)}
                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all ${
                              isSelected
                                ? 'metal-card border-gold/35 text-white'
                                : 'glass border border-white/8 text-white/60 hover:text-white hover:border-white/18'
                            }`}>
                            {isSelected && <span className="text-gold flex-shrink-0 text-xs">✓</span>}
                            <span className="font-medium truncate">{rel.label}</span>
                            {rel.byMarriage && (
                              <span className="text-[0.5rem] text-white/20 flex-shrink-0 ml-auto">by mar.</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="sharp-divider" />
            </div>
          ))}
        </div>

        {/* Footer — selected state */}
        {value && (
          <div className="flex-shrink-0 metal-surface px-5 py-3 flex items-center justify-between">
            <div>
              <p className="text-[0.6rem] text-white/35 uppercase tracking-wide">Selected</p>
              <p className="text-sm font-semibold text-white">{getRelationLabel(value)}</p>
            </div>
            <button onClick={onClose}
              className="metal-btn text-black text-xs font-bold px-5 py-2.5 rounded-full">
              Confirm ✓
            </button>
          </div>
        )}
      </motion.div>
    </>
  )
}
