// src/components/ui/AvatarGeneratorModal.jsx
// AI portrait generator — produces a luxury editorial side-profile
// portrait in the WHO WAS I house style from any uploaded photo.
//
// Steps:
//   1. PICK   — upload a photo or choose from existing memorial photos
//   2. REVIEW — Claude Vision analyses it; shows editable details
//   3. BUILD  — shows the generated prompt; user can tweak
//   4. RENDER — Freepik generates; shows result with accept/retry
//
// Usage:
//   <AvatarGeneratorModal
//     existingPhotos={memorial.photos}
//     currentPhoto={memorial.photo}
//     onAccept={(url) => saveAvatarUrl(url)}
//     onClose={() => setShowGenerator(false)}
//   />

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { generateFromPhoto, generateFromDetails, buildPortraitPrompt, generatePortrait } from '../../lib/avatarGenerator'
import { uploadImage } from '../../lib/storage'

// ─── Step config ──────────────────────────────────────────────────────────────

const STEPS = ['Select photo', 'Review details', 'Generate']

// Manual detail options
const BUILD_OPTIONS = [
  { value: 'slender',        label: 'Slender'       },
  { value: 'average',        label: 'Average build'  },
  { value: 'athletic',       label: 'Athletic'       },
  { value: 'heavyset',       label: 'Heavyset'       },
  { value: 'very heavyset',  label: 'Very heavyset'  },
]
const AGE_OPTIONS = [
  { value: 'young adult',    label: 'Young adult (20s–30s)' },
  { value: 'middle-aged',    label: 'Middle-aged (40s–50s)' },
  { value: 'elderly',        label: 'Elderly (60s+)'        },
]
const GENDER_OPTIONS = [
  { value: 'man',    label: 'Man'    },
  { value: 'woman',  label: 'Woman'  },
  { value: 'person', label: 'Person' },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ pct }) {
  return (
    <div className="w-full h-1 bg-white/8 rounded-full overflow-hidden mt-1">
      <motion.div
        className="h-full bg-gradient-to-r from-gold to-sky rounded-full"
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
      />
    </div>
  )
}

function DetailField({ label, value, onChange, type = 'text', options }) {
  return (
    <div>
      <label className="block text-[0.6rem] font-bold tracking-[0.16em] uppercase text-cream-dim mb-1.5">
        {label}
      </label>
      {options ? (
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-gold/30 transition-colors"
        >
          {options.map(o => (
            <option key={o.value} value={o.value} style={{ background: '#0e0e0e' }}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={type}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white placeholder-white/25 focus:outline-none focus:border-gold/30 transition-colors"
        />
      )}
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function AvatarGeneratorModal({ existingPhotos = [], currentPhoto, onAccept, onClose }) {
  const [step,       setStep]       = useState(0)
  const [sourcePhoto, setSourcePhoto] = useState(currentPhoto || null)
  const [uploading,  setUploading]  = useState(false)
  const [analysing,  setAnalysing]  = useState(false)
  const [generating, setGenerating] = useState(false)
  const [progress,   setProgress]   = useState({ msg: '', pct: 0 })
  const [error,      setError]      = useState('')

  // Details (from Vision or manual)
  const [details, setDetails] = useState({
    gender:              'person',
    ageRange:            'middle-aged',
    build:               'average',
    hairColor:           'dark brown',
    hairLength:          'short',
    hairStyle:           'natural',
    skinTone:            'warm brown',
    heritage:            'multicultural',
    facialHair:          'none',
    distinctiveFeatures: 'gentle features',
    jewelry:             'none',
    culturalMarkings:    'none',
    hairAccent:          'none',
  })

  const [prompt,    setPrompt]    = useState('')
  const [negPrompt, setNegPrompt] = useState('')
  const [result,    setResult]    = useState(null)

  const fileRef = useRef()

  const setDet = key => val => setDetails(d => ({ ...d, [key]: val }))

  function onProgress(msg, pct) { setProgress({ msg, pct }) }

  // ── Step 0 actions ─────────────────────────────────────────────────────────

  async function handleFileUpload(e) {
    const file = e.target.files[0]; if (!file) return
    setUploading(true); setError('')
    try {
      const url = await uploadImage(file, () => {}, 'memorials/sources')
      setSourcePhoto(url)
    } catch { setError('Upload failed. Please try again.') }
    finally { setUploading(false) }
  }

  async function handleAnalyse() {
    if (!sourcePhoto) return
    setAnalysing(true); setError('')
    try {
      // Import analysePhoto dynamically to keep bundle lean
      const { analysePhoto } = await import('../../lib/avatarGenerator')
      const analysed = await analysePhoto(sourcePhoto)
      if (analysed) setDetails(d => ({ ...d, ...analysed }))
      setStep(1)
    } catch { setError('Could not analyse photo. You can edit details manually.'); setStep(1) }
    finally { setAnalysing(false) }
  }

  function handleSkipToManual() { setStep(1) }

  // ── Step 1 actions ─────────────────────────────────────────────────────────

  function handleBuildPrompt() {
    const { positive, negative } = buildPortraitPrompt(details)
    setPrompt(positive)
    setNegPrompt(negative)
    setStep(2)
  }

  // ── Step 2 actions ─────────────────────────────────────────────────────────

  async function handleGenerate() {
    setGenerating(true); setError(''); setResult(null)
    try {
      const imageUrl = await generatePortrait(prompt, negPrompt, onProgress)
      setResult(imageUrl)
    } catch (err) { setError(err.message || 'Generation failed') }
    finally { setGenerating(false) }
  }

  function handleRetry() { setResult(null); handleGenerate() }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40"
      />

      {/* Sheet */}
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="dark-container fixed bottom-0 left-0 right-0 z-50 bg-[#0c0c10] border-t border-white/10 rounded-t-3xl max-h-[92vh] overflow-y-auto"
        style={{ paddingBottom: 'max(24px, env(safe-area-inset-bottom))' }}
      >
        {/* Handle */}
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mt-4 mb-5" />

        <div className="px-5 pb-2">

          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-cream-dim mb-1">
                AI portrait studio
              </p>
              <h2 className="font-display text-2xl font-bold text-white">
                Generate portrait
              </h2>
              <p className="text-xs text-white/40 mt-1">
                Luxury editorial side-profile — emerging from white mist
              </p>
            </div>
            <button onClick={onClose} className="w-8 h-8 glass rounded-full flex items-center justify-center text-white/40 hover:text-white transition-colors mt-1 flex-shrink-0">
              <span className="text-sm">✕</span>
            </button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-7">
            {STEPS.map((s, i) => (
              <div key={i} className="flex items-center gap-2 flex-1">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[0.55rem] font-bold flex-shrink-0 transition-all ${
                  i < step ? 'bg-gold text-black' : i === step ? 'border border-gold text-gold' : 'border border-white/15 text-white/25'
                }`}>
                  {i < step ? '✓' : i + 1}
                </div>
                <span className={`text-xs transition-all ${i === step ? 'text-white font-medium' : 'text-white/30'}`}>
                  {s}
                </span>
                {i < STEPS.length - 1 && <div className="flex-1 h-px bg-white/8" />}
              </div>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="glass rounded-xl p-3 border border-red-500/20 mb-4">
              <p className="text-xs text-red-400">{error}</p>
            </div>
          )}

          <AnimatePresence mode="wait">

            {/* ── STEP 0: Select photo ─────────────────────────────────── */}
            {step === 0 && (
              <motion.div key="s0" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} className="space-y-4">

                {/* Upload new */}
                <div
                  onClick={() => fileRef.current.click()}
                  className="relative w-full h-40 rounded-2xl border border-dashed border-white/15 flex flex-col items-center justify-center cursor-pointer hover:border-gold/30 transition-all overflow-hidden group"
                >
                  {sourcePhoto ? (
                    <>
                      <img src={sourcePhoto} alt="" className="absolute inset-0 w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <p className="text-white text-xs font-semibold">Change photo</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="text-3xl opacity-20 mb-2">✿</div>
                      <p className="text-xs text-white/40 font-medium">Upload a photo of this person</p>
                      <p className="text-[0.6rem] text-white/20 mt-1">{uploading ? 'Uploading…' : 'JPG, PNG, WebP'}</p>
                    </>
                  )}
                </div>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />

                {/* Or choose from gallery */}
                {existingPhotos.length > 0 && (
                  <div>
                    <p className="text-[0.6rem] font-bold tracking-[0.16em] uppercase text-cream-dim mb-2">
                      Or choose from gallery
                    </p>
                    <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
                      {existingPhotos.slice(0, 8).map((p, i) => (
                        <div
                          key={i}
                          onClick={() => setSourcePhoto(p.url)}
                          className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 cursor-pointer transition-all ${
                            sourcePhoto === p.url ? 'ring-2 ring-gold' : 'opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={p.url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Info box */}
                <div className="glass rounded-xl p-4 border border-gold/10">
                  <div className="flex gap-3">
                    <span className="text-gold mt-0.5 flex-shrink-0 text-sm">✦</span>
                    <p className="text-xs text-white/45 leading-relaxed">
                      Claude Vision will read the photo to extract age, build, skin tone, hair, heritage, and any cultural details. You can review and edit everything before generating.
                    </p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-1">
                  <button onClick={handleSkipToManual}
                    className="flex-1 py-3 rounded-xl text-xs font-semibold glass border border-white/10 text-white/50 hover:text-white transition-colors">
                    Enter manually
                  </button>
                  <button
                    onClick={handleAnalyse}
                    disabled={!sourcePhoto || analysing || uploading}
                    className="flex-[2] py-3 rounded-xl text-xs font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-40 transition-opacity"
                  >
                    {analysing
                      ? <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black/80 rounded-full animate-spin" />
                          Analysing…
                        </span>
                      : 'Analyse photo →'}
                  </button>
                </div>
              </motion.div>
            )}

            {/* ── STEP 1: Review / edit details ────────────────────────── */}
            {step === 1 && (
              <motion.div key="s1" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} className="space-y-4">

                {sourcePhoto && (
                  <div className="flex items-center gap-3 glass rounded-xl p-3">
                    <img src={sourcePhoto} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-white">Portrait will be based on this photo</p>
                      <button onClick={() => setStep(0)} className="text-[0.6rem] text-gold hover:text-gold/70 transition-colors mt-0.5">
                        Change photo
                      </button>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <DetailField label="Gender"   value={details.gender}   onChange={setDet('gender')}   options={GENDER_OPTIONS} />
                  <DetailField label="Age range" value={details.ageRange} onChange={setDet('ageRange')} options={AGE_OPTIONS}   />
                  <DetailField label="Build"     value={details.build}    onChange={setDet('build')}    options={BUILD_OPTIONS} />
                  <DetailField label="Skin tone" value={details.skinTone} onChange={setDet('skinTone')} />
                </div>

                <DetailField label="Heritage / ethnicity" value={details.heritage}  onChange={setDet('heritage')} />
                <DetailField label="Hair colour & style"  value={`${details.hairColor}, ${details.hairLength}, ${details.hairStyle}`}
                  onChange={v => {
                    const parts = v.split(',').map(s => s.trim())
                    setDetails(d => ({ ...d, hairColor: parts[0] || d.hairColor, hairLength: parts[1] || d.hairLength, hairStyle: parts[2] || d.hairStyle }))
                  }} />
                <DetailField label="Distinctive features"  value={details.distinctiveFeatures} onChange={setDet('distinctiveFeatures')} />
                <DetailField label="Jewelry (or 'none')"   value={details.jewelry}             onChange={setDet('jewelry')} />
                <DetailField label="Cultural markings"     value={details.culturalMarkings}    onChange={setDet('culturalMarkings')} />

                <button
                  onClick={handleBuildPrompt}
                  className="w-full py-4 rounded-xl text-sm font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 transition-opacity mt-2"
                >
                  Build prompt →
                </button>
              </motion.div>
            )}

            {/* ── STEP 2: Prompt preview + generate ────────────────────── */}
            {step === 2 && (
              <motion.div key="s2" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }} className="space-y-4">

                {/* Show / edit positive prompt */}
                <div>
                  <label className="block text-[0.6rem] font-bold tracking-[0.16em] uppercase text-cream-dim mb-1.5">
                    Portrait prompt
                  </label>
                  <textarea
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    rows={5}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white/70 leading-relaxed focus:outline-none focus:border-gold/30 resize-none transition-colors"
                  />
                </div>

                {/* Result preview */}
                <AnimatePresence>
                  {result && (
                    <motion.div
                      initial={{ opacity:0,scale:0.96 }} animate={{ opacity:1,scale:1 }} exit={{ opacity:0 }}
                      className="relative rounded-2xl overflow-hidden"
                    >
                      <img src={result} alt="Generated portrait" className="w-full rounded-2xl" />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-4 left-4 right-4 flex gap-2">
                        <button
                          onClick={() => { onAccept(result); onClose() }}
                          className="flex-[2] py-3 rounded-xl text-xs font-bold bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 transition-opacity"
                        >
                          ✓ Use this portrait
                        </button>
                        <button
                          onClick={handleRetry}
                          className="flex-1 py-3 rounded-xl text-xs font-semibold glass border border-white/20 text-white/70 hover:text-white transition-colors"
                        >
                          Retry
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Generation progress */}
                {generating && (
                  <div className="glass rounded-xl p-4">
                    <p className="text-xs text-white/60 mb-2">{progress.msg || 'Generating…'}</p>
                    <ProgressBar pct={progress.pct} />
                    <p className="text-[0.6rem] text-white/25 mt-2">
                      This typically takes 15–40 seconds
                    </p>
                  </div>
                )}

                {/* Generate button — only when no result yet */}
                {!result && (
                  <button
                    onClick={handleGenerate}
                    disabled={generating}
                    className="w-full py-4 rounded-xl text-sm font-bold tracking-wider bg-gradient-to-r from-gold to-sky text-black hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {generating
                      ? <span className="flex items-center justify-center gap-2">
                          <div className="w-4 h-4 border-2 border-black/20 border-t-black/80 rounded-full animate-spin" />
                          Generating portrait…
                        </span>
                      : '✦ Generate portrait'}
                  </button>
                )}

                <button onClick={() => setStep(1)}
                  className="w-full py-2 text-xs text-white/25 hover:text-white/40 transition-colors">
                  ← Edit details
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </>
  )
}
