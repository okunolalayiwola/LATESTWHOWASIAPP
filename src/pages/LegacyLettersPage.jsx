// src/pages/LegacyLettersPage.jsx — WHO WAS I LEGACY VAULT
// Route: /memorial/:id/letters
//
// States: setup → locked → authenticating → pinEntry → open → willBuilder → letterComposer
// Auth:   Face ID / Touch ID (WebAuthn) + 6-digit PIN fallback
// Inside: Will & Estate builder + Legacy Letters & Documents

import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'
import { uploadImage } from '../lib/storage'
import VaultDocuments from '../components/ui/VaultDocuments'
import PINInput from '../components/ui/PINInput'
import {
  getVaultId, isVaultSetup, setPIN, verifyPIN, hasPIN,
  isBiometricsAvailable, isBiometricsConditionalAvailable,
  registerBiometrics, authenticateWithBiometrics, hasBiometrics,
  openSession, closeSession, isSessionValid, refreshSession, getSessionTimeLeft,
  requestPINReset, verifyResetCode, clearResetCode,
} from '../lib/vaultAuth'

// ─── Constants ────────────────────────────────────────────────────────────────

const UNLOCK_EVENTS = [
  { value:'graduation', label:'Their graduation',       emoji:'🎓' },
  { value:'wedding',    label:'Their wedding day',      emoji:'💍' },
  { value:'18th',       label:'Their 18th birthday',   emoji:'🎂' },
  { value:'21st',       label:'Their 21st birthday',   emoji:'✦'  },
  { value:'1_year',     label:'1 year after I\'m gone',emoji:'☽'  },
  { value:'when_needed',label:'When they need me most', emoji:'♡'  },
  { value:'christmas',  label:'Next Christmas',         emoji:'✿'  },
]

const PROPERTY_TYPES = ['House', 'Apartment', 'Land', 'Commercial', 'Vehicle', 'Boat', 'Other']
const ASSET_TYPES    = ['Bank Account', 'Savings', 'Shares/Stocks', 'Pension', 'Crypto', 'Business', 'Other']
const DOC_TYPES      = [
  { value:'will', label:'Will Document', icon:'📜' },
  { value:'deed', label:'Property Deed', icon:'🏠' },
  { value:'insurance', label:'Insurance', icon:'🔒' },
  { value:'financial', label:'Financial', icon:'💰' },
  { value:'medical', label:'Medical Directive', icon:'🏥' },
  { value:'other', label:'Other', icon:'📎' },
]

// ─── Vault lock dial (decorative SVG) ─────────────────────────────────────────

function VaultDial({ spinning, unlocking }) {
  return (
    <motion.div
      animate={unlocking ? { rotateZ: [0, 360, -180, 360], scale: [1, 1.05, 1] } : spinning ? { rotateZ: 360 } : {}}
      transition={unlocking
        ? { duration: 1.2, ease: 'easeInOut' }
        : { repeat: Infinity, duration: 8, ease: 'linear' }}
      style={{ width: 160, height: 160, position: 'relative' }}
    >
      <svg viewBox="0 0 160 160" width="160" height="160">
        {/* Outer ring */}
        <circle cx="80" cy="80" r="76" fill="none" stroke="rgba(255,215,0,0.30)" strokeWidth="2" />
        <circle cx="80" cy="80" r="72" fill="rgba(8,8,15,0.95)" />

        {/* Tick marks */}
        {Array.from({ length: 60 }, (_, i) => {
          const angle   = (i / 60) * Math.PI * 2 - Math.PI / 2
          const major   = i % 5 === 0
          const r1      = 72, r2 = major ? 60 : 64
          const x1 = 80 + r1 * Math.cos(angle), y1 = 80 + r1 * Math.sin(angle)
          const x2 = 80 + r2 * Math.cos(angle), y2 = 80 + r2 * Math.sin(angle)
          return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
            stroke={major ? 'rgba(255,215,0,0.60)' : 'rgba(255,215,0,0.18)'}
            strokeWidth={major ? 1.5 : 0.8} strokeLinecap="round" />
        })}

        {/* Inner dial */}
        <circle cx="80" cy="80" r="50" fill="rgba(15,15,24,0.98)" />
        <circle cx="80" cy="80" r="50" fill="none" stroke="rgba(255,215,0,0.22)" strokeWidth="1" />

        {/* Handle */}
        <rect x="74" y="24" width="12" height="24" rx="6"
          fill="rgba(255,215,0,0.80)" />
        <circle cx="80" cy="30" r="5" fill="rgba(255,215,0,0.95)" />

        {/* Center keyhole or open indicator */}
        {unlocking ? (
          <path d="M80 68 L85 80 L83 90 L77 90 L75 80 Z" fill="rgba(255,215,0,0.60)" />
        ) : (
          <>
            <circle cx="80" cy="74" r="6" fill="none" stroke="rgba(255,215,0,0.50)" strokeWidth="1.5" />
            <rect x="77" y="80" width="6" height="10" rx="1" fill="rgba(255,215,0,0.50)" />
          </>
        )}
      </svg>
    </motion.div>
  )
}

// ─── Will builder ──────────────────────────────────────────────────────────────

function WillBuilder({ memorial, existingWill, onSave, onBack }) {
  const [step, setStep]   = useState(0)
  const [saving, setSaving] = useState(false)
  const [agreed, setAgreed] = useState(false)   // UK legal acknowledgement before sealing
  const [will, setWill]   = useState(existingWill || {
    testatorName:   memorial?.name || '',
    dateOfBirth:    '',
    address:        '',
    properties:     [],
    financialAssets:[],
    possessions:    [],
    digitalAssets:  [],
    beneficiaries:  [],
    executorName:   '',
    executorContact:'',
    funeralWishes:  '',
    medicalWishes:  '',
    specialNote:    '',
    status:         'draft',
  })

  const set = k => v => setWill(w => ({ ...w, [k]: v }))

  const STEPS = ['Identity', 'Properties', 'Assets', 'Beneficiaries', 'Executor & Wishes', 'Review & Seal']

  function addProperty() {
    set('properties')([...will.properties, { type:'House', description:'', address:'', value:'', beneficiary:'', pct:'100' }])
  }
  function updateProperty(i, k, v) {
    const arr = [...will.properties]; arr[i] = { ...arr[i], [k]: v }; set('properties')(arr)
  }
  function removeProperty(i) { set('properties')(will.properties.filter((_,idx) => idx !== i)) }

  function addAsset() {
    set('financialAssets')([...will.financialAssets, { type:'Bank Account', institution:'', accountRef:'', value:'', beneficiary:'', pct:'100' }])
  }
  function updateAsset(i, k, v) {
    const arr = [...will.financialAssets]; arr[i] = { ...arr[i], [k]: v }; set('financialAssets')(arr)
  }

  function addBeneficiary() {
    set('beneficiaries')([...will.beneficiaries, { name:'', relation:'', contact:'' }])
  }
  function updateBeneficiary(i, k, v) {
    const arr = [...will.beneficiaries]; arr[i] = { ...arr[i], [k]: v }; set('beneficiaries')(arr)
  }

  const inputCls = 'w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none'
  const labelCls = 'block text-[0.6rem] font-bold tracking-[0.18em] uppercase text-cream-dim mb-1.5'
  const cardCls  = 'metal-card rounded-2xl p-4 mb-3 space-y-3'

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 metal-surface px-5 py-3 flex items-center gap-3">
        <button onClick={onBack} className="w-8 h-8 rubber-btn rounded-full flex items-center justify-center text-white/50 text-sm flex-shrink-0">←</button>
        <div className="flex-1 min-w-0">
          <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-cream-dim">Will & Estate</p>
          <p className="text-sm font-semibold text-white">{STEPS[step]}</p>
        </div>
        <span className="text-xs text-white/30">{step + 1}/{STEPS.length}</span>
      </div>

      {/* Step progress */}
      <div className="flex gap-1 px-5 pt-4 pb-3">
        {STEPS.map((_, i) => (
          <div key={i} className="flex-1 h-1 rounded-full transition-all"
            style={{ background: i <= step ? 'linear-gradient(90deg,#FFD700,#38BDF8)' : 'rgba(255,255,255,0.10)' }} />
        ))}
      </div>

      <div className="px-5 pt-2 space-y-4">

        <AnimatePresence mode="wait">

          {/* STEP 0: Identity */}
          {step === 0 && (
            <motion.div key="s0" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }} className="space-y-4">
              <div className="metal-card rounded-2xl p-5">
                <p className="font-display text-xl font-bold text-white mb-1">Who is this will for?</p>
                <p className="text-xs text-white/40 mb-5">Enter the testator's details — the person making this will.</p>
                <div className="space-y-3">
                  <div><label className={labelCls}>Full legal name</label><input value={will.testatorName} onChange={e=>set('testatorName')(e.target.value)} placeholder="Full name as on legal documents" className={inputCls} /></div>
                  <div><label className={labelCls}>Date of birth</label><input type="date" value={will.dateOfBirth} onChange={e=>set('dateOfBirth')(e.target.value)} className={inputCls} /></div>
                  <div><label className={labelCls}>Home address</label><textarea value={will.address} onChange={e=>set('address')(e.target.value)} rows={2} placeholder="Full residential address" className={inputCls + ' resize-none'} /></div>
                </div>
              </div>
            </motion.div>
          )}

          {/* STEP 1: Properties */}
          {step === 1 && (
            <motion.div key="s1" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <div className="mb-4">
                <p className="font-display text-xl font-bold text-white">Properties & Real Estate</p>
                <p className="text-xs text-white/40 mt-1">Add every property — homes, land, vehicles, other assets.</p>
              </div>
              {will.properties.map((p, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/60">Property {i+1}</p>
                    <button onClick={() => removeProperty(i)} className="text-rose/50 hover:text-rose text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Type</label>
                      <select value={p.type} onChange={e=>updateProperty(i,'type',e.target.value)} className={inputCls}>
                        {PROPERTY_TYPES.map(t => <option key={t} style={{ background:'#0d0d10' }}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>Est. Value</label><input value={p.value} onChange={e=>updateProperty(i,'value',e.target.value)} placeholder="e.g. £250,000" className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Address / Description</label><input value={p.address} onChange={e=>updateProperty(i,'address',e.target.value)} placeholder="Full address or description" className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Beneficiary name</label><input value={p.beneficiary} onChange={e=>updateProperty(i,'beneficiary',e.target.value)} placeholder="Who receives this?" className={inputCls} /></div>
                    <div><label className={labelCls}>Share %</label><input type="number" value={p.pct} onChange={e=>updateProperty(i,'pct',e.target.value)} min="1" max="100" className={inputCls} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addProperty} className="w-full py-3 rubber-btn rounded-2xl text-sm text-white/50 flex items-center justify-center gap-2">
                <span className="text-gold">+</span> Add property
              </button>
              {will.properties.length === 0 && (
                <p className="text-center text-xs text-white/25 py-4">No properties added — tap above to add one.</p>
              )}
            </motion.div>
          )}

          {/* STEP 2: Financial assets */}
          {step === 2 && (
            <motion.div key="s2" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <div className="mb-4">
                <p className="font-display text-xl font-bold text-white">Financial Assets</p>
                <p className="text-xs text-white/40 mt-1">Bank accounts, investments, pensions, crypto, businesses.</p>
              </div>
              {will.financialAssets.map((a, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/60">Asset {i+1}</p>
                    <button onClick={() => set('financialAssets')(will.financialAssets.filter((_,idx)=>idx!==i))} className="text-rose/50 hover:text-rose text-xs">Remove</button>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className={labelCls}>Asset type</label>
                      <select value={a.type} onChange={e=>updateAsset(i,'type',e.target.value)} className={inputCls}>
                        {ASSET_TYPES.map(t => <option key={t} style={{ background:'#0d0d10' }}>{t}</option>)}
                      </select>
                    </div>
                    <div><label className={labelCls}>Approx value</label><input value={a.value} onChange={e=>updateAsset(i,'value',e.target.value)} placeholder="e.g. £10,000" className={inputCls} /></div>
                  </div>
                  <div><label className={labelCls}>Institution / Reference</label><input value={a.institution} onChange={e=>updateAsset(i,'institution',e.target.value)} placeholder="Bank name, account ref, etc." className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Beneficiary</label><input value={a.beneficiary} onChange={e=>updateAsset(i,'beneficiary',e.target.value)} placeholder="Name" className={inputCls} /></div>
                    <div><label className={labelCls}>Share %</label><input type="number" value={a.pct} onChange={e=>updateAsset(i,'pct',e.target.value)} min="1" max="100" className={inputCls} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addAsset} className="w-full py-3 rubber-btn rounded-2xl text-sm text-white/50 flex items-center justify-center gap-2">
                <span className="text-gold">+</span> Add asset
              </button>

              {/* Digital assets */}
              <div className="mt-5">
                <p className="font-display text-lg font-bold text-white mb-1">Digital Assets</p>
                <p className="text-xs text-white/35 mb-3">Crypto wallets, social media, passwords, subscriptions.</p>
                <textarea value={will.digitalAssets?.join?.('\n') || ''} rows={4}
                  onChange={e => set('digitalAssets')(e.target.value.split('\n').filter(Boolean))}
                  placeholder={"e.g.\nBitcoin wallet — seedphrase stored with solicitor\nNetflix — cancel immediately\nInstagram — convert to memorial account"}
                  className={inputCls + ' resize-none leading-relaxed'} />
              </div>
            </motion.div>
          )}

          {/* STEP 3: Beneficiaries */}
          {step === 3 && (
            <motion.div key="s3" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <div className="mb-4">
                <p className="font-display text-xl font-bold text-white">Beneficiaries</p>
                <p className="text-xs text-white/40 mt-1">People who receive from this estate.</p>
              </div>
              {will.beneficiaries.map((b, i) => (
                <div key={i} className={cardCls}>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-bold text-white/60">Beneficiary {i+1}</p>
                    <button onClick={() => set('beneficiaries')(will.beneficiaries.filter((_,idx)=>idx!==i))} className="text-rose/50 hover:text-rose text-xs">Remove</button>
                  </div>
                  <div><label className={labelCls}>Full name</label><input value={b.name} onChange={e=>updateBeneficiary(i,'name',e.target.value)} placeholder="Legal full name" className={inputCls} /></div>
                  <div className="grid grid-cols-2 gap-2">
                    <div><label className={labelCls}>Relation</label><input value={b.relation} onChange={e=>updateBeneficiary(i,'relation',e.target.value)} placeholder="e.g. Son, Wife" className={inputCls} /></div>
                    <div><label className={labelCls}>Contact / DOB</label><input value={b.contact} onChange={e=>updateBeneficiary(i,'contact',e.target.value)} placeholder="Email or date of birth" className={inputCls} /></div>
                  </div>
                </div>
              ))}
              <button onClick={addBeneficiary} className="w-full py-3 rubber-btn rounded-2xl text-sm text-white/50 flex items-center justify-center gap-2">
                <span className="text-gold">+</span> Add beneficiary
              </button>
            </motion.div>
          )}

          {/* STEP 4: Executor & Wishes */}
          {step === 4 && (
            <motion.div key="s4" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }} className="space-y-4">
              <div className="metal-card rounded-2xl p-5 space-y-3">
                <p className="font-display text-lg font-bold text-white">Executor</p>
                <p className="text-xs text-white/40">Person responsible for carrying out this will.</p>
                <div><label className={labelCls}>Executor full name</label><input value={will.executorName} onChange={e=>set('executorName')(e.target.value)} placeholder="Full legal name" className={inputCls} /></div>
                <div><label className={labelCls}>Executor contact</label><input value={will.executorContact} onChange={e=>set('executorContact')(e.target.value)} placeholder="Email, phone, or address" className={inputCls} /></div>
              </div>
              <div className="metal-card rounded-2xl p-5 space-y-3">
                <p className="font-display text-lg font-bold text-white">Final Wishes</p>
                <div><label className={labelCls}>Funeral wishes</label><textarea value={will.funeralWishes} onChange={e=>set('funeralWishes')(e.target.value)} rows={3} placeholder="Burial or cremation, service preferences, location, music, etc." className={inputCls + ' resize-none'} /></div>
                <div><label className={labelCls}>Medical / end-of-life directive</label><textarea value={will.medicalWishes} onChange={e=>set('medicalWishes')(e.target.value)} rows={3} placeholder="Resuscitation wishes, organ donation, etc." className={inputCls + ' resize-none'} /></div>
                <div><label className={labelCls}>Personal note to family</label><textarea value={will.specialNote} onChange={e=>set('specialNote')(e.target.value)} rows={4} placeholder="Anything else you want your family to know…" className={inputCls + ' resize-none leading-relaxed'} /></div>
              </div>
            </motion.div>
          )}

          {/* STEP 5: Review & Seal */}
          {step === 5 && (
            <motion.div key="s5" initial={{ opacity:0,x:24 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-24 }}>
              <div className="metal-card rounded-2xl p-5 mb-4">
                <p className="font-display text-xl font-bold text-white mb-1">Will Summary</p>
                <p className="text-xs text-white/40 mb-5">Review before sealing in the vault.</p>
                {[
                  { label:'Testator',   value: will.testatorName || '—' },
                  { label:'Properties', value: `${will.properties.length} listed` },
                  { label:'Assets',     value: `${will.financialAssets.length} listed` },
                  { label:'Beneficiaries', value: will.beneficiaries.map(b=>b.name).filter(Boolean).join(', ') || '—' },
                  { label:'Executor',   value: will.executorName || '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between py-2.5 border-b border-white/[0.05] last:border-0">
                    <span className="text-xs text-white/35">{label}</span>
                    <span className="text-xs text-white/80 font-medium max-w-[55%] text-right">{value}</span>
                  </div>
                ))}
              </div>

              {/* UK legal acknowledgement — must be accepted before sealing */}
              <div className="metal-card rounded-2xl p-5 border-gold/20 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-gold text-sm flex-shrink-0">⚠</span>
                  <p className="text-[0.7rem] font-bold tracking-[0.14em] uppercase text-gold/80">Important — please read</p>
                </div>
                <div className="space-y-2.5 text-xs text-white/55 leading-relaxed">
                  <p>
                    This Will &amp; Estate record is a <b className="font-semibold text-white/80">digital expression of your wishes, not a legally valid will</b>.
                    In England &amp; Wales, a will is only valid under the <b className="font-semibold text-white/80">Wills Act 1837</b> if it is in writing
                    and signed by you in the presence of <b className="font-semibold text-white/80">two independent witnesses</b> — who must not be
                    beneficiaries — each of whom signs in your presence.
                  </p>
                  <p>
                    WHO WAS I is a secure storage platform, <b className="font-semibold text-white/80">not a solicitor or legal adviser</b>, and does not
                    provide legal advice. To make your wishes legally binding, have your will professionally drafted and
                    properly witnessed, then upload the signed copy to your Documents vault.
                  </p>
                  <p className="text-white/35">
                    Your data is processed under UK GDPR and the Data Protection Act 2018. See the{' '}
                    <Link to="/terms" className="text-gold/70 underline hover:text-gold">Terms of Service</Link> and{' '}
                    <Link to="/privacy" className="text-gold/70 underline hover:text-gold">Privacy Policy</Link>.
                  </p>
                </div>
                <label className="flex items-start gap-3 mt-4 pt-4 border-t border-white/[0.07] cursor-pointer select-none">
                  <input type="checkbox" checked={agreed} onChange={e => setAgreed(e.target.checked)}
                    className="mt-0.5 w-4 h-4 flex-shrink-0 accent-gold cursor-pointer" />
                  <span className="text-xs text-white/70 leading-relaxed">
                    I understand this is a record of my wishes, not a legally executed will, and that I should obtain
                    independent legal advice to make it binding.
                  </span>
                </label>
              </div>

              <button onClick={() => onSave(will)} disabled={saving || !agreed}
                title={!agreed ? 'Please confirm the acknowledgement above' : undefined}
                className="w-full py-4 rounded-2xl text-sm font-bold metal-btn text-black disabled:opacity-40 disabled:cursor-not-allowed mb-3">
                {saving ? 'Sealing…' : '🔒 Seal will in vault'}
              </button>
              <button onClick={() => onSave({ ...will, status:'draft' })} disabled={saving}
                className="w-full py-3 rounded-xl text-xs rubber-btn text-white/45 disabled:opacity-50">
                Save as draft
              </button>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Navigation */}
        {step < 5 && (
          <div className="flex gap-3 mt-4 pb-8">
            {step > 0 && (
              <button onClick={() => setStep(s=>s-1)} className="flex-1 py-3.5 rounded-2xl rubber-btn text-sm text-white/55">← Back</button>
            )}
            <button onClick={() => setStep(s=>s+1)} className="flex-[2] py-3.5 rounded-2xl metal-btn text-black text-sm font-bold">
              {step === STEPS.length - 2 ? 'Review →' : 'Continue →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Letter composer ───────────────────────────────────────────────────────────

function LetterComposer({ memorialId, onClose }) {
  const [form, setForm] = useState({ title:'', recipientName:'', content:'', unlockType:'immediate', unlockDate:'', unlockEvent:'graduation' })
  const [saving, setSaving] = useState(false)
  const set = k => e => setForm(f=>({...f,[k]: typeof e === 'string' ? e : e.target.value}))

  async function save() {
    if (!form.title.trim() || !form.content.trim()) return
    setSaving(true)
    await db.transact([
      db.tx.letters[id()].update({
        title:         form.title.trim(),
        recipientName: form.recipientName.trim(),
        content:       form.content.trim(),
        unlockType:    form.unlockType,
        unlockDate:    form.unlockType==='date' && form.unlockDate ? new Date(form.unlockDate).getTime() : null,
        unlockEvent:   form.unlockType==='event' ? form.unlockEvent : null,
        isLocked:      form.unlockType !== 'immediate',
        createdAt:     Date.now(),
      }).link({ memorial: memorialId }),
    ])
    setSaving(false); onClose()
  }

  const inputCls = 'w-full inset-field rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 focus:outline-none'
  const labelCls = 'block text-[0.6rem] font-bold tracking-[0.18em] uppercase text-cream-dim mb-1.5'

  return (
    <motion.div initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
      transition={{ type:'spring', damping:30, stiffness:300 }}
      className="fixed inset-0 z-50 bg-[#0a0a0f] overflow-y-auto pb-10">
      <div className="metal-surface px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onClose} className="w-8 h-8 rubber-btn rounded-full flex items-center justify-center text-white/50 text-sm flex-shrink-0">✕</button>
        <div>
          <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-cream-dim">Legacy Vault</p>
          <p className="text-sm font-semibold text-white">Write a letter</p>
        </div>
      </div>
      <div className="px-5 pt-5 space-y-4">
        <div><label className={labelCls}>Letter title</label><input value={form.title} onChange={set('title')} placeholder="e.g. For you on your wedding day" className={inputCls} /></div>
        <div><label className={labelCls}>For (recipient's name)</label><input value={form.recipientName} onChange={set('recipientName')} placeholder="e.g. My daughter Sarah" className={inputCls} /></div>

        {/* Unlock type */}
        <div>
          <label className={labelCls}>When should this be opened?</label>
          <div className="grid grid-cols-3 gap-2 mb-3">
            {[{v:'immediate',l:'Now'},{v:'date',l:'On a date'},{v:'event',l:'At event'}].map(opt => (
              <button key={opt.v} onClick={() => setForm(f=>({...f,unlockType:opt.v}))}
                className={`py-2.5 rounded-xl text-xs font-semibold ${form.unlockType===opt.v ? 'metal-btn text-black' : 'rubber-btn text-white/50'}`}>
                {opt.l}
              </button>
            ))}
          </div>
          {form.unlockType === 'date' && (
            <input type="date" value={form.unlockDate} onChange={set('unlockDate')}
              min={new Date().toISOString().split('T')[0]} className={inputCls} />
          )}
          {form.unlockType === 'event' && (
            <div className="grid grid-cols-2 gap-2">
              {UNLOCK_EVENTS.map(e => (
                <button key={e.value} onClick={() => setForm(f=>({...f,unlockEvent:e.value}))}
                  className={`flex items-center gap-2 p-3 rounded-xl text-xs text-left ${form.unlockEvent===e.value ? 'metal-card border-gold/30 text-white' : 'rubber-btn text-white/40'}`}>
                  <span>{e.emoji}</span><span>{e.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className={labelCls}>Your letter</label>
          <textarea value={form.content} onChange={set('content')} rows={10}
            placeholder="Write from the heart. Tell them what you want them to know, what you hope for them, how much they mean to you…"
            className={inputCls + ' resize-none leading-relaxed font-light'} />
        </div>

        <button onClick={save} disabled={!form.title.trim()||!form.content.trim()||saving}
          className="w-full py-4 rounded-2xl font-bold metal-btn text-black disabled:opacity-40">
          {saving ? 'Sealing…' : 'Seal this letter ✦'}
        </button>
      </div>
    </motion.div>
  )
}

// ─── Vault share PIN modal ────────────────────────────────────────────────────
// Three-step flow:
//   Step 1 — re-enter vault PIN to confirm identity
//   Step 2 — select which family members to share with
//   Step 3 — success confirmation

function VaultShareModal({ memorialId, memorialName, userId, familyConnections, onClose }) {
  const [step,     setStep]     = useState('pin')     // 'pin' | 'pick' | 'done'
  const [pin,      setPin]      = useState('')
  const [pinError, setPinError] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [selected, setSelected] = useState(new Set()) // Set of connection IDs
  const [sending,  setSending]  = useState(false)
  const [sentCount, setSentCount] = useState(0)
  const [sendError, setSendError] = useState('')

  async function handleVerifyPin() {
    if (pin.length !== 6) { setPinError('Please enter all 6 digits.'); return }
    setVerifying(true); setPinError('')
    try {
      const ok = await verifyPIN(memorialId, userId, pin)
      if (!ok) { setPinError('Incorrect PIN. Please try again.'); setPin('') }
      else { setStep('pick') }
    } catch { setPinError('Could not verify PIN. Please try again.') }
    finally { setVerifying(false) }
  }

  function toggleRecipient(connId) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(connId)) next.delete(connId)
      else next.add(connId)
      return next
    })
  }

  async function handleSend() {
    if (selected.size === 0) { setSendError('Please select at least one family member.'); return }
    setSending(true); setSendError('')
    const recipients = familyConnections
      .filter(c => selected.has(c.id))
      .map(c => ({ name: c.fromName, email: c.fromEmail }))
      .filter(r => r.email)

    if (recipients.length === 0) {
      setSendError('No valid email addresses for the selected members.'); setSending(false); return
    }

    try {
      const resp = await fetch('/api/vault-share-pin', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          senderName:   '',        // could pass from profile if available
          memorialName: memorialName || '',
          pin,
          recipients,
        }),
      })
      const json = await resp.json()
      setSentCount(json.sent || recipients.length)
      setStep('done')
    } catch {
      setSendError('Could not send. Please check your connection and try again.')
    } finally { setSending(false) }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(8,8,15,0.82)', backdropFilter: 'blur(10px)' }}
    >
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 280 }}
        onClick={e => e.stopPropagation()}
        className="w-full sm:max-w-md metal-card rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-4 flex items-center justify-between flex-shrink-0 border-b border-white/08">
          <div>
            <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-gold/60">◆ Legacy Vault</p>
            <h2 className="font-display text-xl font-bold text-white mt-1">Share Vault Code</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full rubber-btn flex items-center justify-center text-white/40">✕</button>
        </div>

        <div className="px-6 py-6 overflow-y-auto flex-1">
          <AnimatePresence mode="wait">

            {/* ── Step 1: Confirm PIN ──────────────────────────────────── */}
            {step === 'pin' && (
              <motion.div key="pin" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}
                className="space-y-5">
                <div className="glass border border-gold/15 rounded-2xl p-4">
                  <p className="text-xs text-white/60 leading-relaxed">
                    Re-enter your vault PIN to confirm it's really you. The PIN will be sent — encrypted in transit — to the family members you choose.
                  </p>
                </div>

                <div>
                  <label className="block text-[0.6rem] font-bold tracking-[0.2em] uppercase text-white/40 mb-3">
                    Your vault PIN
                  </label>
                  {/* Simple 6-digit input */}
                  <div className="flex gap-2 justify-center">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div key={i} className="w-11 h-14 rounded-xl border flex items-center justify-center text-xl font-bold text-white"
                        style={{ background: 'rgba(255,255,255,.05)', borderColor: pin[i] ? 'rgba(243,178,26,.6)' : 'rgba(255,255,255,.12)' }}>
                        {pin[i] ? '●' : ''}
                      </div>
                    ))}
                  </div>
                  {/* Hidden number input */}
                  <input
                    type="tel"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={pin}
                    onChange={e => { const v = e.target.value.replace(/\D/g, '').slice(0, 6); setPin(v); setPinError('') }}
                    onKeyDown={e => e.key === 'Enter' && handleVerifyPin()}
                    autoFocus
                    className="sr-only"
                    style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
                    id="vault-share-pin-input"
                  />
                  {/* Tap to focus */}
                  <label htmlFor="vault-share-pin-input"
                    className="block text-center text-[0.6rem] text-white/30 tracking-wider mt-3 cursor-pointer">
                    Tap here then type your PIN
                  </label>
                </div>

                {pinError && <p className="text-xs text-rose-400 text-center">{pinError}</p>}

                <button
                  onClick={handleVerifyPin}
                  disabled={pin.length !== 6 || verifying}
                  className="w-full py-4 rounded-2xl text-sm font-bold metal-btn text-black disabled:opacity-40">
                  {verifying ? 'Verifying…' : 'Confirm PIN →'}
                </button>
              </motion.div>
            )}

            {/* ── Step 2: Pick recipients ──────────────────────────────── */}
            {step === 'pick' && (
              <motion.div key="pick" initial={{ opacity:0,x:20 }} animate={{ opacity:1,x:0 }} exit={{ opacity:0,x:-20 }}
                className="space-y-4">
                <p className="text-sm text-white/55 leading-relaxed">
                  Choose which family members to send the vault PIN to. Only approved members with a recorded email are shown.
                </p>

                {familyConnections.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-4xl mb-3 opacity-20">👨‍👩‍👧</p>
                    <p className="text-sm text-white/40">No approved family members yet.</p>
                    <p className="text-xs text-white/25 mt-1">Share your invite code to add family members first.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {familyConnections.map(conn => {
                      const hasEmail = !!conn.fromEmail
                      const isChecked = selected.has(conn.id)
                      return (
                        <button key={conn.id}
                          onClick={() => hasEmail && toggleRecipient(conn.id)}
                          disabled={!hasEmail}
                          className="w-full flex items-center gap-3 p-4 rounded-2xl border transition-all text-left"
                          style={{
                            background: isChecked ? 'rgba(243,178,26,.08)' : 'rgba(255,255,255,.03)',
                            borderColor: isChecked ? 'rgba(243,178,26,.35)' : 'rgba(255,255,255,.08)',
                            opacity: hasEmail ? 1 : 0.4,
                          }}>
                          {/* Avatar */}
                          <div className="w-10 h-10 rounded-full flex-shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold"
                            style={{ background: 'rgba(243,178,26,.15)', color: 'rgba(243,178,26,.8)', border: '1px solid rgba(243,178,26,.2)' }}>
                            {conn.fromPhoto
                              ? <img loading="lazy" decoding="async" src={conn.fromPhoto} alt="" className="w-full h-full object-cover" />
                              : (conn.fromName?.[0] || '?').toUpperCase()}
                          </div>
                          {/* Info */}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate">{conn.fromName || 'Family member'}</p>
                            <p className="text-[0.6rem] text-white/35 truncate">
                              {conn.relation} · {hasEmail ? conn.fromEmail : 'No email recorded'}
                            </p>
                          </div>
                          {/* Checkbox */}
                          <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs"
                            style={{
                              background: isChecked ? '#f3b21a' : 'rgba(255,255,255,.06)',
                              border: `1px solid ${isChecked ? '#f3b21a' : 'rgba(255,255,255,.12)'}`,
                              color: isChecked ? '#15120e' : 'transparent',
                            }}>
                            {isChecked ? '✓' : ''}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}

                {sendError && <p className="text-xs text-rose-400 text-center">{sendError}</p>}

                <button
                  onClick={handleSend}
                  disabled={selected.size === 0 || sending || familyConnections.length === 0}
                  className="w-full py-4 rounded-2xl text-sm font-bold metal-btn text-black disabled:opacity-40">
                  {sending ? 'Sending…' : `Send to ${selected.size} ${selected.size === 1 ? 'person' : 'people'} →`}
                </button>
                <button onClick={() => { setStep('pin'); setPin(''); setSelected(new Set()) }}
                  className="w-full py-3 text-xs text-white/30 hover:text-white/50 transition-colors">
                  ← Change PIN
                </button>
              </motion.div>
            )}

            {/* ── Step 3: Done ─────────────────────────────────────────── */}
            {step === 'done' && (
              <motion.div key="done" initial={{ opacity:0, scale:.96 }} animate={{ opacity:1, scale:1 }}
                className="text-center space-y-5 py-4">
                <div className="text-5xl">✦</div>
                <h3 className="font-display text-2xl font-bold text-white">Vault code sent</h3>
                <p className="text-sm text-white/55 leading-relaxed">
                  The vault PIN was emailed securely to <strong className="text-white">{sentCount}</strong> family {sentCount === 1 ? 'member' : 'members'}.
                  They can use it to access the vault on this memorial.
                </p>
                <div className="glass border border-white/08 rounded-2xl p-4">
                  <p className="text-xs text-white/35 leading-relaxed">
                    ⚠ Remind them to keep the code private and not share it further unless authorised. You can change your PIN at any time from the vault lock screen.
                  </p>
                </div>
                <button onClick={onClose}
                  className="w-full py-4 rounded-2xl text-sm font-bold metal-btn text-black">
                  Done ✓
                </button>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Vault content (open state) ────────────────────────────────────────────────

function VaultContent({ memorial, memorialId, userId, onLock, letters, wills, documents }) {
  const navigate                = useNavigate()
  const [view, setView]         = useState('home')   // 'home' | 'will' | 'letters' | 'docs' | 'newLetter' | 'willBuilder'
  const [selectedWill, setSelectedWill] = useState(null)
  const [saving, setSaving]     = useState(false)
  const [showShare, setShowShare] = useState(false)

  // Approved family connections for this memorial — used in the share-PIN flow
  const { data: connData } = db.useQuery({
    familyConnections: { $: { where: { toMemorialId: memorialId, status: 'approved' } } },
  })
  const familyConnections = connData?.familyConnections || []

  async function saveWill(willData) {
    setSaving(true)
    try {
      const existing = wills[0]
      const willId   = existing?.id || id()
      await db.transact([
        db.tx.wills[willId].update({ ...willData, updatedAt: Date.now(), createdAt: existing?.createdAt || Date.now() })
          .link({ memorial: memorialId }),
      ])
      setView('home')
    } finally { setSaving(false) }
  }

  async function deleteLetter(letterId) {
    await db.transact([db.tx.letters[letterId].delete()])
  }

  const existingWill = wills?.[0]
  const isOwner      = true  // already verified by vault auth

  if (view === 'willBuilder') {
    return <WillBuilder memorial={memorial} existingWill={existingWill} onSave={saveWill} onBack={() => setView('home')} />
  }

  if (view === 'newLetter') {
    return (
      <AnimatePresence>
        <LetterComposer memorialId={memorialId} onClose={() => setView('letters')} />
      </AnimatePresence>
    )
  }

  // ── Home (vault contents overview) ────────────────────────────────────────
  if (view === 'home') {
    return (
      <div className="min-h-screen pb-24">
        {/* Vault open header */}
        <div className="metal-surface px-5 py-4 flex items-center justify-between sticky top-0 z-10">
          <div className="flex items-center gap-2.5 min-w-0">
            {/* Back to the memorial — exits the vault without locking it */}
            <button onClick={() => navigate(`/memorial/${memorialId}`)}
              title="Back to memorial"
              className="w-9 h-9 rubber-btn rounded-full flex items-center justify-center text-white/55 hover:text-white transition-colors flex-shrink-0">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="w-2 h-2 rounded-full bg-mint animate-pulse flex-shrink-0" style={{ boxShadow:'0 0 8px #34D399' }} />
            <div className="min-w-0">
              <p className="text-[0.55rem] font-bold tracking-[0.22em] uppercase text-mint/70">Vault open</p>
              <p className="font-display text-base font-bold text-white truncate">{memorial?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <button onClick={() => setShowShare(true)}
              className="rubber-btn text-[0.65rem] font-bold tracking-wide uppercase text-gold/70 px-4 py-2 rounded-full flex items-center gap-1.5"
              title="Share vault code with family">
              📤 <span className="hidden sm:inline">Share code</span>
            </button>
            <button onClick={onLock}
              className="rubber-btn text-[0.65rem] font-bold tracking-wide uppercase text-white/50 px-4 py-2 rounded-full flex items-center gap-1.5">
              🔒 <span className="hidden sm:inline">Lock</span>
            </button>
          </div>
        </div>

        <div className="px-5 pt-6 space-y-4">

          {/* Two main vault options */}
          <motion.button initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.1 }}
            onClick={() => setView('willBuilder')}
            className="w-full metal-card rounded-3xl p-6 text-left hover:opacity-90 transition-opacity relative overflow-hidden">
            {/* Decorative corner */}
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5"
              style={{ background:'radial-gradient(circle, #FFD700, transparent)', transform:'translate(30%, -30%)' }} />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl rubber-tile flex items-center justify-center text-3xl flex-shrink-0">📜</div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <p className="font-display text-xl font-bold text-white">Will & Estate</p>
                  {existingWill ? (
                    <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-mint/15 border border-mint/25 text-mint">
                      {existingWill.status === 'draft' ? 'Draft' : 'Complete'}
                    </span>
                  ) : (
                    <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-white/8 text-white/30">Not started</span>
                  )}
                </div>
                <p className="text-xs text-white/45 leading-relaxed">
                  Legally-structured will with properties, assets, beneficiary allocation, executor, and final wishes.
                </p>
              </div>
            </div>
            {existingWill && (
              <div className="mt-4 flex gap-3 text-[0.6rem] text-white/30">
                <span>📋 {existingWill.properties?.length || 0} properties</span>
                <span>💰 {existingWill.financialAssets?.length || 0} assets</span>
                <span>👤 {existingWill.beneficiaries?.length || 0} beneficiaries</span>
              </div>
            )}
          </motion.button>

          <motion.button initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.2 }}
            onClick={() => setView('letters')}
            className="w-full metal-card rounded-3xl p-6 text-left hover:opacity-90 transition-opacity relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5"
              style={{ background:'radial-gradient(circle, #38BDF8, transparent)', transform:'translate(30%, -30%)' }} />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl rubber-tile flex items-center justify-center text-3xl flex-shrink-0">✉</div>
              <div className="flex-1">
                <p className="font-display text-xl font-bold text-white mb-1">Legacy Letters</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Time-sealed personal messages, unlocked on a date or life event — a graduation, a wedding, a birthday.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 text-[0.6rem] text-white/30">
              <span>✉ {letters?.length || 0} letter{letters?.length !== 1 ? 's' : ''}</span>
            </div>
          </motion.button>

          <motion.button initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.3 }}
            onClick={() => setView('docs')}
            className="w-full metal-card rounded-3xl p-6 text-left hover:opacity-90 transition-opacity relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 opacity-5"
              style={{ background:'radial-gradient(circle, #34D399, transparent)', transform:'translate(30%, -30%)' }} />
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl rubber-tile flex items-center justify-center text-3xl flex-shrink-0">📂</div>
              <div className="flex-1">
                <p className="font-display text-xl font-bold text-white mb-1">Official Documents</p>
                <p className="text-xs text-white/45 leading-relaxed">
                  Store wills, deeds, insurance policies, medical directives, and any important files your family will need.
                </p>
              </div>
            </div>
            <div className="mt-4 flex gap-3 text-[0.6rem] text-white/30">
              <span>📎 {documents?.length || 0} document{documents?.length !== 1 ? 's' : ''}</span>
            </div>
          </motion.button>

          {/* Share vault code hint */}
          <motion.div initial={{ opacity:0,y:10 }} animate={{ opacity:1,y:0 }} transition={{ delay:0.4 }}
            className="metal-card rounded-2xl px-5 py-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold text-white/70">Share vault access</p>
              <p className="text-[0.65rem] text-white/35 leading-relaxed mt-0.5">
                Send the vault PIN securely to selected family members via email.
              </p>
            </div>
            <button onClick={() => setShowShare(true)}
              className="flex-shrink-0 metal-btn text-black text-xs font-bold px-4 py-2 rounded-full">
              Share →
            </button>
          </motion.div>
        </div>

        {/* Share vault PIN modal */}
        <AnimatePresence>
          {showShare && (
            <VaultShareModal
              memorialId={memorialId}
              memorialName={memorial?.name}
              userId={userId}
              familyConnections={familyConnections}
              onClose={() => setShowShare(false)}
            />
          )}
        </AnimatePresence>
      </div>
    )
  }

  // ── Letters list ─────────────────────────────────────────────────────────
  if (view === 'letters') {
    const sorted = [...(letters || [])].sort((a,b) => (a.unlockDate||0)-(b.unlockDate||0))
    return (
      <div className="min-h-screen pb-24">
        <div className="metal-surface px-5 py-4 flex items-center gap-3 sticky top-0 z-10">
          <button onClick={() => setView('home')} className="w-8 h-8 rubber-btn rounded-full flex items-center justify-center text-white/50 text-sm flex-shrink-0">←</button>
          <div className="flex-1"><p className="text-sm font-semibold text-white">Legacy Letters</p></div>
          <button onClick={() => setView('newLetter')} className="metal-btn text-black text-xs font-bold px-4 py-2 rounded-full">+ Write</button>
        </div>
        <div className="px-5 pt-5 space-y-3">
          {sorted.length === 0 ? (
            <div className="text-center py-16">
              <div className="text-5xl opacity-15 mb-4">✉</div>
              <p className="text-white/35 text-sm mb-6">No letters yet.</p>
              <button onClick={() => setView('newLetter')} className="metal-btn text-black text-sm font-bold px-6 py-3 rounded-full">Write the first letter</button>
            </div>
          ) : sorted.map(letter => (
            <VaultLetterCard key={letter.id} letter={letter} onDelete={deleteLetter} />
          ))}
        </div>
      </div>
    )
  }

  // ── Documents list ──────────────────────────────────────────────────────
  if (view === 'docs') {
    return (
      <VaultDocuments
        memorialId={memorialId}
        documents={documents}
        onBack={() => setView('home')}
      />
    )
  }

  return null
}

// ─── Vault letter card (hooks live here, not inside a map) ────────────────────

function VaultLetterCard({ letter, onDelete }) {
  const [expanded, setExpanded] = useState(false)
  const [confirm,  setConfirm]  = useState(false)

  const unlockDate = letter.unlockDate ? new Date(letter.unlockDate) : null
  const isPast     = unlockDate && unlockDate <= new Date()
  const canRead    = !letter.isLocked || isPast || letter.unlockType === 'immediate'
  const unlock     = letter.unlockType === 'immediate' ? 'Available now'
    : letter.unlockType === 'event'
      ? `On: ${UNLOCK_EVENTS.find(e => e.value === letter.unlockEvent)?.label || letter.unlockEvent}`
      : unlockDate
        ? unlockDate.toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })
        : '—'

  return (
    <div className="metal-card rounded-2xl overflow-hidden">
      <div className={`p-5 flex items-start gap-4 ${canRead ? 'cursor-pointer' : ''}`}
        onClick={() => canRead && setExpanded(e => !e)}>
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl flex-shrink-0 ${canRead ? 'rubber-tile text-gold' : 'bg-white/5 text-white/20'}`}>
          {canRead ? '✉' : '🔒'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-white truncate">{letter.title}</p>
            <button
              onClick={e => { e.stopPropagation(); if (confirm) { onDelete(letter.id) } else { setConfirm(true); setTimeout(() => setConfirm(false), 3000) } }}
              className={`text-xs flex-shrink-0 ${confirm ? 'text-rose' : 'text-white/15 hover:text-white/35'}`}>
              {confirm ? 'Sure?' : '✕'}
            </button>
          </div>
          {letter.recipientName && <p className="text-xs text-white/35 mt-0.5">For {letter.recipientName}</p>}
          <span className={`inline-flex items-center gap-1 mt-2 text-[0.58rem] px-2.5 py-1 rounded-full font-medium ${
            canRead ? 'bg-gold/12 border border-gold/20 text-gold/80' : 'bg-white/5 text-white/25'
          }`}>
            {canRead ? '🔓' : '🔒'} {unlock}
          </span>
        </div>
      </div>
      {expanded && canRead && (
        <div>
          <div className="sharp-divider" />
          <div className="px-5 py-5">
            <p className="text-sm text-white/70 leading-relaxed whitespace-pre-wrap font-light">{letter.content}</p>
            <p className="text-[0.6rem] text-white/20 mt-4">
              Written {new Date(letter.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── MAIN PAGE ────────────────────────────────────────────────────────────────

export default function LegacyLettersPage() {
  const { id: memorialId } = useParams()
  const navigate           = useNavigate()
  const { user }           = db.useAuth()

  // Auth state: 'checking' | 'setup' | 'locked' | 'authenticating' | 'pinEntry' | 'creatingPin' | 'open'
  const [authState,   setAuthState]   = useState('checking')
  const [pinInput,    setPinInput]    = useState('')
  const [pinError,    setPinError]    = useState(false)
  const [pinStep,     setPinStep]     = useState('enter') // 'enter' | 'confirm'
  const [pinFirst,    setPinFirst]    = useState('')
  const [bioAvailable, setBioAvail]   = useState(false)
  const [bioError,    setBioError]    = useState('')
  const [unlocking,   setUnlocking]   = useState(false)
  const [sessionLeft, setSessionLeft] = useState(0)
  const [resetStage,  setResetStage]  = useState(null) // null | 'sending' | 'enterCode' | 'newPin'
  const [resetError,  setResetError]  = useState('')
  const [accountEmail, setAccountEmail] = useState('')
  const [setupStep,   setSetupStep]   = useState('understand') // 'understand' | 'pin'
  const idleTimer = useRef(null)

  const vaultId = getVaultId(memorialId || '')
  const uid     = user?.id || 'anon'

  // Queries — only run when vault is open
  const { data } = db.useQuery(
    memorialId && authState === 'open' ? {
      memorials: {
        $: { where: { id: memorialId } },
        letters:   {},
        wills:     {},
        documents: {},
      }
    } : null
  )

  const memorial  = data?.memorials?.[0]
  const letters   = memorial?.letters   || []
  const wills     = memorial?.wills     || []
  const documents = memorial?.documents || []

  // Lightweight always-running query — provides the memorial name & photo
  // BEFORE the vault is opened (the full data query above is gated on 'open')
  const { data: lockData } = db.useQuery(
    memorialId ? { memorials: { $: { where: { id: memorialId } } } } : null
  )
  const lockMemorial    = lockData?.memorials?.[0]
  const lockFirstName   = lockMemorial?.name?.split(' ')?.[0]
  // Creator check:
  //  • If memorial has creatorId set → must match the logged-in user
  //  • If creatorId is missing (older memorial) → any logged-in user can set up the vault
  //    (prevents visitors from being permanently locked out of unowned memorials)
  const isVaultCreator  = !!(
    user &&
    lockMemorial &&
    (!lockMemorial.creatorId || lockMemorial.creatorId === user.id)
  )

  // ── Check auth state on mount ─────────────────────────────────────────────
  useEffect(() => {
    async function check() {
      // If session still valid, skip auth
      if (isSessionValid(memorialId, uid)) {
        setAuthState('open'); return
      }
      // Check if biometrics available
      const bioAvail = await isBiometricsConditionalAvailable()
      setBioAvail(bioAvail && isBiometricsAvailable())

      if (!isVaultSetup(memorialId, uid)) {
        setAuthState('setup')
      } else {
        setAuthState('locked')
      }
    }
    if (memorialId && uid) check()
  }, [memorialId, uid])

  // ── Auto-lock timer ───────────────────────────────────────────────────────
  useEffect(() => {
    if (authState !== 'open') return
    const tick = setInterval(() => {
      if (!isSessionValid(memorialId, uid)) {
        lock()
      } else {
        refreshSession(memorialId, uid)
        setSessionLeft(getSessionTimeLeft(memorialId, uid))
      }
    }, 30000)
    return () => clearInterval(tick)
  }, [authState, memorialId, uid])

  // ── Auth actions ──────────────────────────────────────────────────────────

  async function tryBiometrics() {
    setBioError(''); setAuthState('authenticating')
    try {
      const ok = await authenticateWithBiometrics(memorialId, uid)
      if (ok) { unlockVault(); return }
    } catch (err) {
      const msg = err.name === 'NotAllowedError' ? 'Biometric authentication was cancelled.'
        : err.name === 'InvalidStateError'       ? 'No biometric credential found. Use your PIN.'
        : 'Biometric failed. Please use your PIN.'
      setBioError(msg)
      setAuthState('locked')
    }
  }

  async function tryPIN(pin) {
    if (authState === 'creatingPin') {
      if (pinStep === 'enter') {
        setPinFirst(pin); setPinStep('confirm'); return
      }
      if (pin !== pinFirst) {
        setPinError(true); setPinStep('enter'); setPinFirst('')
        setTimeout(() => setPinError(false), 600); return
      }
      // Confirmed — save PIN and optionally register biometrics
      await setPIN(memorialId, uid, pin)
      // Try to register biometrics too
      if (bioAvailable) {
        try { await registerBiometrics(memorialId, uid, user?.email) } catch {}
      }
      unlockVault(); return
    }

    // Verifying existing PIN
    const ok = await verifyPIN(memorialId, uid, pin)
    if (!ok) { setPinError(true); setTimeout(() => setPinError(false), 600); return }
    unlockVault()
  }

  function unlockVault() {
    setUnlocking(true)
    setTimeout(() => {
      openSession(memorialId, uid)
      setAuthState('open')
      setUnlocking(false)
      setSetupStep('understand')  // reset so consent shows fresh if vault is ever re-created
    }, 1200)
  }

  function lock() {
    closeSession(memorialId, uid)
    setAuthState('locked')
    setBioError('')
  }

  // ── PIN reset flow ─────────────────────────────────────────────────────────

  async function startPINReset() {
    setResetStage('sending')
    setResetError('')
    try {
      // Get the user's email from the auth context
      const email = user?.email || ''
      setAccountEmail(email)

      if (!email) {
        setResetError('No email address found on your account.')
        setResetStage(null)
        return
      }

      // Generate a reset code locally (hash stored, plain code returned)
      const code = await requestPINReset(memorialId, uid)

      // Send the code via the API endpoint
      const resp = await fetch('/api/vault-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, memorialName: memorial?.name || '' }),
      })

      if (!resp.ok) throw new Error('Failed to send email')

      setResetStage('enterCode')
    } catch (err) {
      setResetError('Could not send reset email. Please try again.')
      setResetStage(null)
    }
  }

  async function submitResetCode(code) {
    setResetError('')
    const valid = await verifyResetCode(memorialId, uid, code)
    if (!valid) {
      setResetError('Invalid or expired code. Please try again.')
      return
    }
    setResetStage('newPin')
  }

  async function setNewPinAfterReset(pin) {
    // Clear old PIN and set the new one
    await setPIN(memorialId, uid, pin)
    clearResetCode(memorialId, uid)
    setResetStage(null)
    setResetError('')
    unlockVault()
  }

  // ─── RENDER ────────────────────────────────────────────────────────────────

  // Vault is open
  if (authState === 'open') {
    return (
      <div className="relative z-10 min-h-screen bg-[#08080f]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <VaultContent
          memorial={memorial}
          memorialId={memorialId}
          userId={uid}
          onLock={lock}
          letters={letters}
          wills={wills}
          documents={documents}
        />
      </div>
    )
  }

  // ── Lock/Auth screen ────────────────────────────────────────────────────────
  return (
    <div className="relative z-10 min-h-screen bg-[#08080f] flex flex-col">

      {/* Back button */}
      <div className="px-5 pt-16 pb-0 flex items-center">
        <button onClick={() => navigate(`/memorial/${memorialId}`)}
          className="w-9 h-9 rubber-btn rounded-full flex items-center justify-center text-white/50 hover:text-white transition-colors">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center pb-20">

        {/* WHO WAS I label */}
        <p className="text-[0.6rem] font-bold tracking-[0.32em] uppercase text-cream-dim mb-2">
          WHO WAS I
        </p>

        {/* Vault dial */}
        <div className="mb-6">
          <VaultDial
            spinning={authState === 'checking' || authState === 'authenticating'}
            unlocking={unlocking}
          />
        </div>

        {/* Title — shows the memorial subject's first name when available */}
        {lockFirstName && (
          <p className="font-display text-xl font-semibold text-white/50 mb-0.5 tracking-wide">
            {lockFirstName}'s
          </p>
        )}
        <h1 className="font-display text-3xl font-bold text-white mb-1">Legacy Vault</h1>
        <p className="text-xs text-white/30 mb-1 font-mono tracking-widest">VAULT ID: {vaultId}</p>

        <AnimatePresence mode="wait">

          {/* ── SETUP: still fetching memorial data ───────────────── */}
          {authState === 'setup' && !lockMemorial && (
            <motion.div key="setup-loading" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="mt-10 text-center">
              <div className="w-9 h-9 border-2 border-gold/25 border-t-gold rounded-full animate-spin mx-auto mb-3" />
              <p className="text-xs text-white/25">Loading vault…</p>
            </motion.div>
          )}

          {/* ── SETUP: vault not initialised — visitor, not creator ── */}
          {authState === 'setup' && lockMemorial && !isVaultCreator && (
            <motion.div key="not-ready" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="w-full max-w-xs mt-8 text-center space-y-4">
              <div className="text-5xl opacity-20">🔐</div>
              <p className="text-sm text-white/55 leading-relaxed">
                {lockFirstName ? `${lockFirstName}'s` : 'This'} vault hasn't been set up yet.
              </p>
              <p className="text-xs text-white/25 leading-relaxed max-w-[26ch] mx-auto">
                The memorial creator needs to set a vault PIN before anyone else can access it.
              </p>
            </motion.div>
          )}

          {/* ── SETUP: creator flow ─────────────────────────────────── */}
          {(authState === 'setup' || authState === 'creatingPin') && isVaultCreator && (
            <motion.div key="setup" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="w-full max-w-xs mt-8">

              {setupStep === 'understand' ? (
                /* Step 1 — Do you understand? */
                <>
                  <p className="font-display text-xl font-bold text-white text-center mb-1">
                    Before you continue
                  </p>
                  <p className="text-xs text-white/40 text-center mb-5 leading-relaxed">
                    You're setting up the vault for{' '}
                    <span className="text-white font-semibold">{lockMemorial?.name}</span>.
                  </p>

                  <div className="glass rounded-2xl p-5 mb-5 border border-gold/15 space-y-4">
                    {[
                      `This PIN protects ${lockFirstName ? `${lockFirstName}'s` : 'the'} Legacy Vault — letters, will documents and private files.`,
                      'Family members and trusted people you share it with will use this same PIN to access the vault.',
                      'Write it somewhere safe. You can reset it via email, but it cannot be recovered without your account.',
                    ].map((tip, i) => (
                      <div key={i} className="flex gap-3 items-start">
                        <span className="text-gold text-xs mt-0.5 flex-shrink-0">✦</span>
                        <p className="text-xs text-white/55 leading-relaxed">{tip}</p>
                      </div>
                    ))}
                  </div>

                  <button
                    onClick={() => setSetupStep('pin')}
                    className="w-full py-4 metal-btn text-black rounded-2xl font-bold text-sm mb-3">
                    Yes, I understand →
                  </button>
                  <p className="text-[0.58rem] text-white/15 text-center leading-relaxed">
                    Do you understand? By continuing you confirm that you have read the above.
                  </p>
                </>
              ) : (
                /* Step 2 — Choose PIN */
                <>
                  <p className="text-sm text-white/50 mb-2 leading-relaxed text-center">
                    Create a 6-digit PIN to secure{lockFirstName ? ` ${lockFirstName}'s` : ' this'} vault.
                    {bioAvailable && ' Biometric authentication will also be enabled.'}
                  </p>
                  <div className="glass rounded-2xl p-4 mb-6 border border-gold/15">
                    <p className="text-xs text-white/40 leading-relaxed">
                      ✦ Your PIN is hashed — never stored in plain text.{' '}
                      {bioAvailable ? 'Face ID / Fingerprint will be registered for fast access.' : ''}
                    </p>
                  </div>
                  <PINInput
                    label={pinStep === 'confirm' ? 'Confirm your PIN' : 'Choose a 6-digit PIN'}
                    onComplete={pin => { setAuthState('creatingPin'); tryPIN(pin) }}
                    error={pinError}
                  />
                  <button onClick={() => setSetupStep('understand')}
                    className="text-xs text-white/25 hover:text-white/45 transition-colors mt-5 w-full">
                    ← Back
                  </button>
                </>
              )}
            </motion.div>
          )}

          {/* ── LOCKED: main lock screen ───────────────────────────── */}
          {authState === 'locked' && (
            <motion.div key="locked" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="w-full max-w-xs mt-8 space-y-3">
              {bioError && (
                <div className="glass rounded-xl px-4 py-2.5 border border-rose/20 mb-2">
                  <p className="text-xs text-rose/80">{bioError}</p>
                </div>
              )}

              {/* Biometric button */}
              {hasBiometrics(memorialId, uid) && bioAvailable && (
                <motion.button
                  whileTap={{ scale:0.96 }}
                  onClick={tryBiometrics}
                  className="w-full py-5 metal-card rounded-2xl border-gold/20 flex flex-col items-center gap-3 hover:opacity-90 transition-opacity">
                  <div className="w-14 h-14 rounded-full rubber-tile flex items-center justify-center text-3xl">
                    {/iPhone|iPad|Mac/.test(navigator.userAgent) ? '👤' : '✋'}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">
                      {/iPhone|iPad/.test(navigator.userAgent) ? 'Use Face ID / Touch ID' : 'Use Fingerprint / Face Unlock'}
                    </p>
                    <p className="text-xs text-white/35 mt-0.5">Tap to authenticate</p>
                  </div>
                </motion.button>
              )}

              {/* PIN option */}
              <button
                onClick={() => setAuthState('pinEntry')}
                className={`w-full py-4 rounded-2xl text-sm font-semibold transition-all flex items-center justify-center gap-2 ${
                  hasBiometrics(memorialId, uid) ? 'rubber-btn text-white/55' : 'metal-btn text-black'
                }`}>
                <span>🔢</span>
                <span>Use {hasBiometrics(memorialId, uid) ? 'PIN instead' : '6-digit PIN'}</span>
              </button>
            </motion.div>
          )}

          {/* ── AUTHENTICATING ────────────────────────────────────── */}
          {authState === 'authenticating' && (
            <motion.div key="auth" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="mt-8 text-center">
              <div className="w-12 h-12 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-white/50">Authenticating…</p>
              <p className="text-xs text-white/25 mt-1">Check your device</p>
            </motion.div>
          )}

          {/* ── PIN ENTRY ─────────────────────────────────────────── */}
          {authState === 'pinEntry' && (
            <motion.div key="pin" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="mt-6 w-full max-w-xs">
              <PINInput label="Enter your vault PIN" onComplete={tryPIN} error={pinError} />
              <button onClick={() => setAuthState('locked')} className="text-xs text-white/25 hover:text-white/45 transition-colors mt-6 w-full">
                ← Back
              </button>
              <button onClick={startPINReset}
                className="text-xs text-gold/60 hover:text-gold transition-colors mt-3 w-full">
                Forgot your PIN? Reset via email
              </button>
            </motion.div>
          )}

          {/* ── PIN RESET ──────────────────────────────────────────── */}
          {resetStage && (
            <motion.div key="reset" initial={{ opacity:0,y:16 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0 }}
              className="mt-6 w-full max-w-xs">

              {resetStage === 'sending' && (
                <div className="text-center">
                  <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin mx-auto mb-4" />
                  <p className="text-sm text-white/50">Emailing your reset code…</p>
                </div>
              )}

              {resetStage === 'enterCode' && (
                <>
                  <p className="text-sm text-white/55 mb-2 text-center">
                    We emailed a 6-digit code to<br/>
                    <span className="text-white">{accountEmail}</span>
                  </p>
                  <p className="text-xs text-white/30 mb-6 text-center">It expires in 15 minutes.</p>
                  <PINInput label="Enter the code from your email"
                    onComplete={submitResetCode} error={!!resetError} />
                  {resetError && <p className="text-xs text-rose/80 text-center mt-4">{resetError}</p>}
                  <button onClick={startPINReset}
                    className="text-xs text-white/30 hover:text-white/55 mt-5 w-full">
                    Resend code
                  </button>
                </>
              )}

              {resetStage === 'newPin' && (
                <>
                  <p className="text-sm text-mint mb-6 text-center">Code verified ✓ Choose a new PIN</p>
                  <PINInput label="New 6-digit PIN" onComplete={setNewPinAfterReset} />
                </>
              )}

              <button onClick={() => { setResetStage(null); setResetError(''); setAuthState('locked') }}
                className="text-xs text-white/25 hover:text-white/45 transition-colors mt-6 w-full">
                ← Cancel reset
              </button>
            </motion.div>
          )}

          {/* ── UNLOCKING animation ────────────────────────────────── */}
          {unlocking && (
            <motion.div key="unlock" initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              className="mt-8 text-center">
              <motion.div animate={{ scale:[1,1.1,1] }} transition={{ duration:0.6, repeat:1 }}
                className="text-4xl mb-3">🔓</motion.div>
              <p className="text-sm font-semibold text-mint">Vault opening…</p>
            </motion.div>
          )}

        </AnimatePresence>

        {/* Note */}
        {(authState === 'locked' || authState === 'setup') && (
          <p className="text-[0.58rem] text-white/15 mt-8 max-w-xs leading-relaxed">
            This vault is private. Authentication is stored only on this device.
            WHO WAS I cannot access your vault contents.
          </p>
        )}

      </div>
    </div>
  )
}
