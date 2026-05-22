// api/analyze-photos.js
// Multimodal Claude analysis of a memorial's uploaded photos.
// Runs ONCE per memorial (fire-and-forget from the client after create).
// Result is written back to memorials.photoContext via the InstantDB admin SDK.
//
// POST /api/analyze-photos
// Body: { memorialId, name, bio, isSelf, alive, birthYear, deathYear, photoUrls: [] }
// Returns: { ok: true, photoContext: string } — also persists to the memorial.
//
// The photoContext string is injected into the AI persona system prompt by
// ConversationPage and TalkScreen so the AI "knows" what the person looks
// like and what their life visually contained.

import { init } from '@instantdb/admin'

const MAX_PHOTOS_FOR_VISION = 8   // cap cost + latency. Claude vision handles a few images well.
const MODEL                 = 'claude-sonnet-4-20250514'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  const ADMIN_TOKEN       = process.env.INSTANT_APP_ADMIN_TOKEN
  const APP_ID            = process.env.VITE_INSTANT_APP_ID

  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured' })
  if (!ADMIN_TOKEN || !APP_ID) return res.status(500).json({ error: 'InstantDB admin not configured' })

  const {
    memorialId,
    name      = 'this person',
    bio       = '',
    isSelf    = false,
    alive     = true,
    birthYear,
    deathYear,
    photoUrls = [],
  } = req.body || {}

  if (!memorialId)               return res.status(400).json({ error: 'memorialId required' })
  if (!Array.isArray(photoUrls) || photoUrls.length === 0)
    return res.status(400).json({ error: 'photoUrls array required' })

  // Cap, dedupe, keep order (chronological from client)
  const urls = [...new Set(photoUrls)].slice(0, MAX_PHOTOS_FOR_VISION)

  // Build the multimodal user message: a list of image blocks then a text block.
  const contentBlocks = [
    ...urls.map(url => ({
      type:   'image',
      source: { type: 'url', url },
    })),
    {
      type: 'text',
      text: [
        `These are real-life photos from ${name}'s life${isSelf ? ' (the person uploading is the subject themselves)' : ''}.`,
        bio ? `\nShort biography written by the family:\n"""${bio.slice(0, 800)}"""` : '',
        birthYear ? `\nBorn: ${birthYear}.` : '',
        !alive && deathYear ? `\nPassed away: ${deathYear}.` : '',
        `\nWrite a single, dense paragraph (~150-200 words) of VISUAL CONTEXT that will be given to an AI persona embodying ${name}. The persona will reference this when speaking to family. Cover:`,
        `\n• Visible era/decades (clothing styles, photo film vs. digital quality, settings)`,
        `\n• Recurring places/landscapes/settings (home, country, urban/rural, climate)`,
        `\n• People who appear with them across photos (couple, kids, friends — describe but don't name unless obvious from context)`,
        `\n• Activities, hobbies, work, celebrations visible`,
        `\n• Style cues — how they dress, carry themselves, recurring colours/aesthetic`,
        `\n• Apparent age range across the photos (young, middle, elder)`,
        `\nWrite in third person ("they"). Do NOT make assumptions about identity, religion, race, or politics beyond what's visually obvious. If something is ambiguous, omit it. Don't list — write flowing prose. Don't preface with "Here is" or "I see" — just the description.`,
      ].join(''),
    },
  ]

  try {
    // ── Claude vision call ────────────────────────────────────────────────────
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 600,
        messages:   [{ role: 'user', content: contentBlocks }],
      }),
    })

    const data = await r.json()
    if (!r.ok) {
      console.error('[analyze-photos] Claude error:', data)
      return res.status(r.status).json({ error: data?.error?.message || 'Claude vision failed' })
    }

    const photoContext = (data.content?.[0]?.text || '').trim()
    if (!photoContext) {
      return res.status(500).json({ error: 'Empty vision response' })
    }

    // ── Persist to InstantDB via admin SDK ────────────────────────────────────
    const adminDb = init({ appId: APP_ID, adminToken: ADMIN_TOKEN })
    await adminDb.transact([
      adminDb.tx.memorials[memorialId].update({
        photoContext,
        photoContextAt: Date.now(),
      }),
    ])

    return res.status(200).json({ ok: true, photoContext })
  } catch (err) {
    console.error('[analyze-photos] error:', err)
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}
