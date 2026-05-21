// src/pages/PersonaProfilePage.jsx
// Memory Profile — guided interview that builds the AI persona knowledge base.
//
// Route: /memorial/:id/persona  (owner-only)
//
// Six chapters, each saved to personaProfiles. The flow adapts copy to:
//   • Self mode (interviewing yourself in 2nd person) vs Other mode
//     (interviewing a family member about the subject).
//   • Living vs deceased — present-tense vs past-tense framing.
//
// Saves on chapter completion ("Save & continue") + autosave on tab switch.
// The data here feeds buildSystemPrompt() in TalkScreen for the
// "hear them speak" AI conversation.

import { useState, useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { id } from '@instantdb/react'
import { db } from '../lib/instant'

// ─── Chapters definition ──────────────────────────────────────────────────────
// Each chapter has a list of question objects with adaptive prompt builders.
// `placeholder` is a hint, not enforced. Long answers welcome — the AI is
// happier with detail than brevity.

const CHAPTERS = [
  {
    id: 'identity',
    label: 'Foundations',
    icon: '◉',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `Let's start with the basics of who you are.`
      : `Let's start with the foundations of who ${name} ${isLiving ? 'is' : 'was'}.`,
    questions: [
      { key: 'birthplace', label: ({ isSelf, name }) => isSelf ? 'Where were you born?'
          : `Where ${name ? 'was ' + name : 'were they'} born?`,
        placeholder: 'City, country, hospital if known.', size: 'sm' },
      { key: 'raisedIn',   label: ({ isSelf, name, isLiving }) => isSelf
          ? 'Where did you grow up?'
          : `Where ${isLiving ? 'did' : 'did'} ${name || 'they'} grow up?`,
        placeholder: 'Towns, neighbourhoods, the homes you lived in, defining settings of childhood.', size: 'md' },
      { key: 'education',  label: ({ isSelf, name, isLiving }) => isSelf
          ? 'Walk through your education'
          : `Walk through ${name ? name + "'s" : 'their'} education`,
        placeholder: 'Schools attended, subjects loved/hated, teachers who mattered, qualifications, defining academic moments.', size: 'lg' },
      { key: 'occupation', label: ({ isSelf, name }) => isSelf
          ? 'What do/did you do for work?'
          : `What ${name ? 'did ' + name : 'did they'} do for work?`,
        placeholder: 'Job titles, employers, roles, why they chose this path.', size: 'sm' },
      { key: 'careerSummary', label: ({ isSelf, name, isLiving }) => isSelf
          ? 'Tell the story of your career'
          : `Tell the story of ${name ? name + "'s" : 'their'} career`,
        placeholder: `Major moves, proudest achievements, the work ${isSelf ? 'you' : 'they'} pour${isSelf ? '' : (isLiving ? '' : 'ed')} ${isSelf ? 'yourself' : (isLiving ? 'themselves' : 'themselves')} into.`,
        size: 'lg' },
    ],
  },

  {
    id: 'personality',
    label: 'Personality & voice',
    icon: '✦',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `How do you come across to others? This shapes how the AI talks back as you.`
      : `How ${isLiving ? 'do' : 'did'} ${name || 'they'} come across to others? This shapes how the AI talks back.`,
    questions: [
      { key: 'personalityTraits', label: ({ isSelf, isLiving }) => isSelf
          ? 'Describe your personality'
          : `Describe their personality`,
        placeholder: 'Warm or guarded? Bold or careful? Patient or restless? Generous, stubborn, curious, funny, soft-spoken? Use sentences — the AI uses every word.',
        size: 'xl' },
      { key: 'senseOfHumor', label: () => 'What kind of humour did they have?',
        placeholder: 'Dry, slapstick, dad jokes, sarcasm, deadpan, never told jokes but laughed at everything?',
        size: 'md' },
      { key: 'catchphrases', label: ({ isSelf, name }) => isSelf
          ? "Phrases you say all the time"
          : `Phrases ${name || 'they'} said all the time`,
        placeholder: '“Well, I’ll be…” / “Pass me the salt, love.” / nicknames they used. These give the AI an unmistakable voice.',
        size: 'md' },
      { key: 'speechStyle', label: () => 'How did they speak?',
        placeholder: 'Accent, pace, big words or plain, formal or casual, ended sentences with…? Curse words?',
        size: 'md' },
      { key: 'exampleResponses', label: () => 'Three things they’d actually say',
        placeholder: 'Give three short example replies as if they were responding right now. e.g.\n• "Don’t worry love, I’m right here."\n• "Now don’t you start with that nonsense."\n• "Make sure you eat, you hear me?"',
        size: 'xl' },
    ],
  },

  {
    id: 'life',
    label: 'Life chapters',
    icon: '☽',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `Walk through your life decade by decade. The richer this is, the deeper the AI's recall.`
      : `Walk through ${name ? name + "'s" : 'their'} life chronologically. The more detail, the better the AI remembers.`,
    questions: [
      { key: 'childhood', label: ({ isSelf, name }) => isSelf
          ? 'Childhood (0–12 years)'
          : `${name ? name + "'s" : 'Their'} childhood (0–12 years)`,
        placeholder: 'Where they lived, family setup, defining experiences, what they loved doing as a kid, what shaped them.',
        size: 'xl' },
      { key: 'youngAdult', label: ({ isSelf, name }) => isSelf
          ? 'Teens & young adulthood (13–30)'
          : `${name ? name + "'s" : 'Their'} teens & young adulthood (13–30)`,
        placeholder: 'First loves, college/army/work, leaving home, friendships, dreams they chased, mistakes they made.',
        size: 'xl' },
      { key: 'midLife', label: ({ isSelf, name }) => isSelf
          ? 'Middle years (30–60)'
          : `${name ? name + "'s" : 'Their'} middle years (30–60)`,
        placeholder: 'Marriage, children, career peak, big moves, losses, the decade they grew into themselves.',
        size: 'xl' },
      { key: 'laterYears', label: ({ isSelf, name, isLiving }) => isSelf
          ? 'Later years (60 onwards)'
          : `${name ? name + "'s" : 'Their'} later years (60 ${isLiving ? 'onwards' : 'to the end'})`,
        placeholder: 'Retirement, grandchildren, slowing down, illnesses, the things they kept doing or finally let go of.',
        size: 'xl' },
    ],
  },

  {
    id: 'people',
    label: 'The people in their life',
    icon: '♡',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `The relationships that mattered most. Helps the AI talk to family members it doesn't yet "know".`
      : `The people who mattered to ${name || 'them'}. Helps the AI respond differently to a child than to a sibling.`,
    questions: [
      { key: 'spouse',         label: () => 'Spouse / partner', placeholder: 'Name, how they met, how they were together, kindest moments and the rough patches.', size: 'lg' },
      { key: 'children',       label: () => 'Children',         placeholder: 'For each child: name, what made each of them special to the parent, how they’d address them.', size: 'lg' },
      { key: 'parents',        label: () => 'Their parents',    placeholder: 'Names, the kind of people they were, how they shaped this person.', size: 'md' },
      { key: 'siblings',       label: () => 'Their siblings',   placeholder: 'Names, dynamic — closest one, the joker, the one they lost touch with.', size: 'md' },
      { key: 'closestFriends', label: () => 'Closest friends',  placeholder: 'Friends-as-family, friends from work, friends they made and kept for decades.', size: 'md' },
    ],
  },

  {
    id: 'values',
    label: 'Beliefs & values',
    icon: '✶',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `What you believe in. What you'd tell your grandkids matters most.`
      : `What ${name || 'they'} believed in. Helps the AI answer "what would they say about…" questions.`,
    questions: [
      { key: 'values',     label: () => 'Core values', placeholder: 'Honesty, family, hard work, freedom, faith, kindness, justice — and a sentence on what each one meant to them in practice.', size: 'xl' },
      { key: 'faith',      label: () => 'Faith or spirituality (optional)', placeholder: 'Religion, denomination, practices, how seriously they took it, their relationship with God or the universe.', size: 'md' },
      { key: 'philosophy', label: () => 'Their philosophy of life (optional)', placeholder: 'What they’d tell a younger person about how to live, the regrets and lessons that shaped their worldview.', size: 'lg' },
    ],
  },

  {
    id: 'stories',
    label: 'Stories & memories',
    icon: '◈',
    intro: ({ name, isSelf, isLiving }) => isSelf
      ? `The stories you tell and re-tell. Pure gold for the AI.`
      : `The stories ${name || 'they'} told and re-told. Pure gold for the AI.`,
    questions: [
      { key: 'signatureStories', label: () => 'Signature stories — the ones they always retold', placeholder: 'Tell each story in their voice if you can. The funny incident at the wedding, the time they fixed the car with a coin, the year the river froze. Specific details matter.', size: 'xl' },
      { key: 'proudMoments',     label: () => 'Proudest moments', placeholder: 'The achievements, the gifts they gave, the people they helped, the days they’d relive if they could.', size: 'lg' },
      { key: 'hobbies',          label: () => 'Hobbies, passions, expertise', placeholder: 'Gardening, fishing, scripture, football team, what they could talk about for an hour without notes.', size: 'md' },
    ],
  },
]

// ─── Question + chapter helpers ───────────────────────────────────────────────

function rowsFor(size) {
  if (size === 'xl') return 8
  if (size === 'lg') return 6
  if (size === 'md') return 4
  return 2
}

function chapterCompletion(profile, chapter) {
  if (!profile) return 0
  const filled = chapter.questions.filter(q => (profile[q.key] || '').trim().length > 10).length
  return filled / chapter.questions.length
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function PersonaProfilePage() {
  const { id: memorialId } = useParams()
  const navigate = useNavigate()
  const { user, isLoading: authLoading } = db.useAuth()

  const [chapterIdx, setChapterIdx]   = useState(0)
  const [form,       setForm]         = useState({})
  const [saving,     setSaving]       = useState(false)
  const [lastSaved,  setLastSaved]    = useState(null)
  const formRef = useRef(form)
  formRef.current = form

  // Load memorial + existing profile
  const { data, isLoading } = db.useQuery(memorialId ? {
    memorials:       { $: { where: { id: memorialId } } },
    personaProfiles: { $: { where: { memorialId } } },
  } : null)

  const memorial = data?.memorials?.[0]
  const profile  = data?.personaProfiles?.[0]
  const isSelf   = memorial?.isSelf === true
  const isLiving = memorial?.alive  !== false
  const isOwner  = user && memorial && (memorial.createdBy === user.id || memorial.creatorId === user.id)
  const name     = isSelf ? 'you' : (memorial?.name || 'them')

  // Hydrate form when profile loads
  useEffect(() => {
    if (!profile) return
    setForm(f => {
      // Don't overwrite local edits
      const next = { ...profile }
      Object.keys(f).forEach(k => { if (f[k] !== undefined && f[k] !== null) next[k] = f[k] })
      return next
    })
  }, [profile?.id])

  // Persist on chapter change (autosave)
  useEffect(() => {
    return () => { void saveAll() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterIdx])

  async function saveAll() {
    if (!user || !memorialId || !isOwner) return
    const snapshot = formRef.current
    if (!snapshot || Object.keys(snapshot).length === 0) return

    setSaving(true)
    try {
      // Compute which chapters are now completed
      const completedChapters = CHAPTERS
        .filter(ch => chapterCompletion({ ...profile, ...snapshot }, ch) >= 0.5)
        .map(ch => ch.id)

      const payload = {
        memorialId,
        ownerId:           user.id,
        ...Object.fromEntries(
          Object.entries(snapshot)
            .filter(([k, v]) => CHAPTERS.some(c => c.questions.some(q => q.key === k)))
            .map(([k, v]) => [k, typeof v === 'string' ? v.trim() : v])
        ),
        completedChapters,
        updatedAt: Date.now(),
      }

      if (profile?.id) {
        await db.transact([db.tx.personaProfiles[profile.id].update(payload)])
      } else {
        await db.transact([
          db.tx.personaProfiles[id()].update({ ...payload, createdAt: Date.now() }),
        ])
      }
      setLastSaved(Date.now())
    } catch (e) {
      console.warn('Persona save failed', e)
    } finally {
      setSaving(false)
    }
  }

  // ── Loading / guard ────────────────────────────────────────────────────────
  if (authLoading || isLoading) return (
    <div className="ppp-loader">
      <div className="ppp-spin" />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        .ppp-loader { min-height: 100vh; display:flex; align-items:center; justify-content:center; }
        .ppp-spin   { width: 32px; height: 32px; border-radius: 50%;
          border: 2px solid rgba(255,215,0,0.2); border-top-color: #FFD700;
          animation: spin 0.8s linear infinite; }`}</style>
    </div>
  )

  if (!user || !memorial) return (
    <div className="relative z-10 min-h-screen flex items-center justify-center text-center px-6"
      style={{ paddingTop: 'max(80px, env(safe-area-inset-top))' }}>
      <div>
        <p className="text-white/55 mb-4">Memorial not found.</p>
        <Link to="/dashboard" className="text-gold text-sm">Back to dashboard →</Link>
      </div>
    </div>
  )

  if (!isOwner) return (
    <div className="relative z-10 min-h-screen flex items-center justify-center text-center px-6"
      style={{ paddingTop: 'max(80px, env(safe-area-inset-top))' }}>
      <div>
        <div className="text-3xl opacity-20 mb-3">🔒</div>
        <p className="text-white/65 mb-2">Only the owner can build the memory profile.</p>
        <Link to={`/memorial/${memorialId}`} className="text-gold text-sm">View memorial →</Link>
      </div>
    </div>
  )

  // ── Render ─────────────────────────────────────────────────────────────────
  const chapter   = CHAPTERS[chapterIdx]
  const ctx       = { name, isSelf, isLiving }
  const totalDone = CHAPTERS.filter(ch => chapterCompletion({ ...profile, ...form }, ch) >= 0.5).length

  return (
    <div className="ppp-page">
      <div className="ppp-shell">
        {/* Top header */}
        <header className="ppp-head">
          <div>
            <p className="ppp-eyebrow">◆ Memory profile</p>
            <h1 className="ppp-title">{memorial.name}</h1>
            <p className="ppp-sub">
              {isSelf
                ? `Build the memory profile that will speak as you, when you're no longer able to.`
                : `Build the memory profile that lets ${memorial.name?.split(' ')[0]} speak again — in their own voice, with their own knowledge.`}
            </p>
          </div>
          <div className="ppp-meta">
            <div className="ppp-progress">
              <div className="ppp-progress-fill" style={{ width: `${(totalDone / CHAPTERS.length) * 100}%` }} />
            </div>
            <p className="ppp-progress-txt">
              {totalDone}/{CHAPTERS.length} chapters · {saving ? 'saving…' : lastSaved ? 'saved' : 'autosaves'}
            </p>
          </div>
        </header>

        {/* Chapter rail */}
        <nav className="ppp-rail">
          {CHAPTERS.map((ch, i) => {
            const done = chapterCompletion({ ...profile, ...form }, ch) >= 0.5
            const isActive = i === chapterIdx
            return (
              <button key={ch.id} onClick={() => setChapterIdx(i)}
                className={`ppp-rail-btn ${isActive ? 'active' : ''} ${done ? 'done' : ''}`}>
                <span className="ppp-rail-icon">{done ? '✓' : ch.icon}</span>
                <span>{ch.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Chapter body */}
        <AnimatePresence mode="wait">
          <motion.section
            key={chapter.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
            className="ppp-chapter"
          >
            <p className="ppp-chap-intro">{chapter.intro(ctx)}</p>

            <div className="ppp-questions">
              {chapter.questions.map(q => {
                const label       = typeof q.label === 'function' ? q.label(ctx) : q.label
                const placeholder = typeof q.placeholder === 'function' ? q.placeholder(ctx) : q.placeholder
                const value       = form[q.key] ?? profile?.[q.key] ?? ''
                return (
                  <div key={q.key} className="ppp-q">
                    <label className="ppp-q-label">{label}</label>
                    <textarea
                      rows={rowsFor(q.size)}
                      value={value}
                      onChange={e => setForm(f => ({ ...f, [q.key]: e.target.value }))}
                      onBlur={() => saveAll()}
                      placeholder={placeholder}
                      className="ppp-q-input"
                    />
                    <p className="ppp-q-meta">
                      {(value || '').length} characters
                      {value.length > 200 && ' · the more detail, the better the AI knows them'}
                    </p>
                  </div>
                )
              })}
            </div>

            {/* Footer nav */}
            <div className="ppp-foot">
              <button
                onClick={() => { saveAll(); setChapterIdx(Math.max(0, chapterIdx - 1)) }}
                disabled={chapterIdx === 0}
                className="ppp-btn ppp-btn-ghost"
              >
                ← Previous chapter
              </button>
              <button
                onClick={() => { saveAll(); setChapterIdx(Math.min(CHAPTERS.length - 1, chapterIdx + 1)) }}
                disabled={chapterIdx === CHAPTERS.length - 1}
                className="ppp-btn ppp-btn-go"
              >
                Save & continue →
              </button>
            </div>

            {chapterIdx === CHAPTERS.length - 1 && (
              <div className="ppp-done">
                <p className="ppp-done-eyebrow">◉ Memory profile saved</p>
                <p>
                  The AI will read everything you've written here when family members open the
                  "Hear them speak" conversation. You can come back any time to add more — the
                  more chapters you complete, the richer the conversation becomes.
                </p>
                <Link to={`/memorial/${memorialId}`} className="ppp-btn ppp-btn-go" style={{ marginTop: 18 }}>
                  Back to memorial →
                </Link>
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </div>

      <style>{`
        .ppp-page  {
          min-height: 100vh;
          padding-top:    max(80px, env(safe-area-inset-top) + 16px);
          padding-bottom: max(96px, env(safe-area-inset-bottom) + 80px);
          padding-left: 16px; padding-right: 16px;
          color: rgba(255,255,255,0.85);
        }
        .ppp-shell { max-width: 880px; margin: 0 auto; }

        .ppp-head {
          display: flex; gap: 18px; align-items: flex-start;
          padding-bottom: 18px;
          border-bottom: 1px solid rgba(255,255,255,0.08);
          margin-bottom: 20px;
          flex-wrap: wrap;
        }
        .ppp-eyebrow {
          margin: 0 0 6px; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: .22em; text-transform: uppercase;
          color: rgba(255,215,0,0.65);
        }
        .ppp-title {
          margin: 0; font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: 32px; font-weight: 700; letter-spacing: -.02em;
          color: #fff;
        }
        .ppp-sub {
          margin: 8px 0 0; font-size: 13.5px; line-height: 1.6;
          color: rgba(255,255,255,0.55); max-width: 580px;
        }
        .ppp-meta { margin-left: auto; text-align: right; min-width: 200px; }
        .ppp-progress {
          height: 4px; border-radius: 2px;
          background: rgba(255,255,255,0.08); overflow: hidden;
        }
        .ppp-progress-fill {
          height: 100%; border-radius: 2px;
          background: linear-gradient(90deg, #FFD700, #38BDF8);
          transition: width 0.4s ease;
        }
        .ppp-progress-txt {
          margin: 6px 0 0; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: .12em; text-transform: uppercase;
          color: rgba(255,255,255,0.42);
        }

        .ppp-rail {
          display: flex; flex-wrap: wrap; gap: 6px;
          margin-bottom: 22px;
        }
        .ppp-rail-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 8px 13px; border-radius: 999px;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: rgba(255,255,255,0.55);
          font-family: inherit; font-size: 12px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .ppp-rail-btn:hover { color: #fff; background: rgba(255,255,255,0.07); }
        .ppp-rail-btn.active {
          background: rgba(255,215,0,0.12);
          border-color: rgba(255,215,0,0.40);
          color: #FFD700;
        }
        .ppp-rail-btn.done .ppp-rail-icon {
          color: #34D399; font-weight: 800;
        }
        .ppp-rail-icon { font-size: 12.5px; }

        .ppp-chapter {
          background: rgba(15,15,22,0.85);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 22px; padding: 26px 28px 22px;
        }
        .ppp-chap-intro {
          margin: 0 0 22px; font-family: 'Cormorant Garamond', Georgia, serif;
          font-style: italic; font-size: 17px; color: rgba(255,255,255,0.72);
          line-height: 1.6;
        }
        .ppp-questions { display: flex; flex-direction: column; gap: 22px; }
        .ppp-q-label {
          display: block; margin-bottom: 8px;
          font-family: 'Space Grotesk', system-ui, sans-serif;
          font-size: 14.5px; font-weight: 700; color: #fff;
          letter-spacing: -.005em;
        }
        .ppp-q-input {
          width: 100%; resize: vertical;
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.10);
          border-radius: 14px; padding: 12px 14px;
          color: #fff; font-family: 'Space Grotesk', sans-serif;
          font-size: 14px; line-height: 1.6;
          outline: none; transition: border-color 0.15s;
        }
        .ppp-q-input:focus { border-color: rgba(255,215,0,0.45); }
        .ppp-q-input::placeholder { color: rgba(255,255,255,0.25); }
        .ppp-q-meta {
          margin: 6px 4px 0; font-family: 'JetBrains Mono', monospace;
          font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase;
          color: rgba(255,255,255,0.28);
        }

        .ppp-foot {
          display: flex; gap: 12px; justify-content: space-between;
          margin-top: 24px;
          padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.06);
        }
        .ppp-btn {
          padding: 11px 22px; border-radius: 999px; cursor: pointer;
          border: 1px solid transparent;
          font-family: inherit; font-size: 12.5px; font-weight: 700;
          letter-spacing: .04em; transition: all 0.15s;
        }
        .ppp-btn:disabled { opacity: 0.4; cursor: default; }
        .ppp-btn-ghost {
          background: transparent; color: rgba(255,255,255,0.6);
          border-color: rgba(255,255,255,0.14);
        }
        .ppp-btn-ghost:hover:not(:disabled) { color: #fff; border-color: rgba(255,255,255,0.25); }
        .ppp-btn-go {
          background: linear-gradient(135deg, #FFD700, #38BDF8);
          color: #0a0a12;
          box-shadow: 0 4px 16px rgba(255,215,0,0.25);
        }
        .ppp-btn-go:hover:not(:disabled) { box-shadow: 0 6px 22px rgba(255,215,0,0.35); }

        .ppp-done {
          margin-top: 22px; padding: 18px 20px;
          background: linear-gradient(135deg, rgba(255,215,0,0.10), rgba(56,189,248,0.06));
          border: 1px solid rgba(255,215,0,0.28);
          border-radius: 16px;
        }
        .ppp-done-eyebrow {
          margin: 0 0 6px; font-family: 'JetBrains Mono', monospace;
          font-size: 10px; letter-spacing: .22em; text-transform: uppercase;
          color: rgba(255,215,0,0.85);
        }
        .ppp-done p {
          margin: 0; font-size: 13px; line-height: 1.6;
          color: rgba(255,255,255,0.7);
        }

        @media (max-width: 720px) {
          .ppp-meta { margin-left: 0; text-align: left; }
          .ppp-chapter { padding: 22px 18px 18px; }
          .ppp-foot { flex-direction: column-reverse; }
          .ppp-foot .ppp-btn { width: 100%; }
        }
      `}</style>
    </div>
  )
}
