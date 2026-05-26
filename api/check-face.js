// api/check-face.js
// Face validation for the talk-portrait training upload.
//
// POST { photoUrl }
// Returns: { ok: boolean, reason: string }
//
// Design philosophy (REVISED):
//   The previous version asked the model to REJECT unless ALL of 6 strict
//   criteria pass, then fell closed on any ambiguity. Real users with
//   perfectly fine face photos were getting blocked because the model would
//   nitpick about framing, lighting or partial sunglasses.
//
//   The new approach inverts the question: ACCEPT if there's a usable
//   human face in the photo. Only reject for the unambiguous failure
//   modes — no face at all, multiple people in equal focus, a drawing /
//   animal / object, or severely degraded image. When the model can't be
//   reached we still fail closed (defence in depth), but the prompt no
//   longer fails closed itself.

import { Buffer } from 'node:buffer'

// Use a dated model ID for stability (aliases occasionally lag behind
// rollouts). Falls back to a known-good Sonnet on the off chance Haiku
// 4.5 hasn't propagated for this account.
const PRIMARY_MODEL  = 'claude-haiku-4-5'
const FALLBACK_MODEL = 'claude-sonnet-4-20250514'

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Anthropic API key not configured' })

  const { photoUrl } = req.body || {}
  if (!photoUrl) return res.status(400).json({ error: 'photoUrl required' })

  // Permissive prompt — accept if there's a usable face, reject only on
  // unambiguous failures. The model is told explicitly when in doubt
  // to say YES, because the talk-portrait generator downstream will
  // surface its own errors if the photo really is unworkable.
  const RULES = `You are checking whether a photo can be used as a face reference for portrait generation.

Say "yes" if the photo shows a real human face that is recognisable. Be GENEROUS — slightly off-centre, partial side-profile, mild shadow, or a phone selfie are all fine.

Say "no" ONLY when the photo clearly fails one of these obvious tests:
- No human face is present at all (landscape, object, document, animal, food, body part without face).
- It's an illustration, cartoon, painting, statue, doll, mannequin, or obviously AI-generated.
- Multiple people in equal focus (we need ONE subject).
- The face is so blurred / dark / distorted that no features are visible.
- The face is completely hidden (mask, hand over face).

If you're not sure, say "yes". Borderline cases pass.

Respond with ONLY a JSON object, no other text. Format:
{"face":"yes"}  OR  {"face":"no","reason":"<short specific reason>"}`

  const buildBody = (model) => ({
    model,
    max_tokens: 120,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'url', url: photoUrl } },
          { type: 'text',  text: RULES },
        ],
      },
      // Prefill so the assistant continues from "{" — no preamble, no markdown.
      { role: 'assistant', content: '{' },
    ],
  })

  async function callClaude(model) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(buildBody(model)),
    })
    const data = await r.json()
    return { status: r.status, ok: r.ok, data }
  }

  // ── Diagnostic context preserved across the whole handler so any
  // error path can log the photoUrl + model + Claude response together.
  const ctx = { photoUrl: photoUrl.slice(0, 200), model: PRIMARY_MODEL, claudeStatus: 0, raw: '' }

  try {
    // 1. Primary attempt — Haiku 4.5
    let { status, ok, data } = await callClaude(PRIMARY_MODEL)
    ctx.claudeStatus = status

    // 2. If the primary model errored (404 model not found, 400 bad model,
    //    overloaded, etc.), retry once with the dated Sonnet 4. This
    //    survives the case where the alias hasn't propagated yet.
    if (!ok) {
      console.warn('[check-face] primary failed', status, JSON.stringify(data).slice(0, 200))
      ctx.model = FALLBACK_MODEL
      const retry = await callClaude(FALLBACK_MODEL)
      status = retry.status; ok = retry.ok; data = retry.data
      ctx.claudeStatus = status
    }

    if (!ok) {
      console.error('[check-face] both models failed', { ...ctx, body: JSON.stringify(data).slice(0, 300) })
      return res.status(200).json({
        ok:     false,
        reason: 'Could not verify this photo. Please try again in a moment.',
      })
    }

    ctx.raw = (data.content?.[0]?.text || '').trim()
    // Re-add the prefilled "{" that Claude was forced to continue from
    const jsonStr = ctx.raw.startsWith('{') ? ctx.raw : `{${ctx.raw}`
    // Strip anything after the closing brace (defensive — sometimes models add trailing text)
    const lastBrace = jsonStr.lastIndexOf('}')
    const cleanJson = lastBrace > 0 ? jsonStr.slice(0, lastBrace + 1) : jsonStr

    let parsed
    try {
      parsed = JSON.parse(cleanJson)
    } catch (parseErr) {
      // Heuristic recovery — if the response mentions "yes" anywhere and
      // doesn't mention "no" we accept it; otherwise fall back to reject.
      // Bad JSON shouldn't kill a perfectly valid face photo.
      const t = ctx.raw.toLowerCase()
      const looksYes = /"face"\s*:\s*"yes"|^\s*yes\b/.test(t) || (t.includes('yes') && !t.includes('"no"'))
      if (looksYes) {
        console.warn('[check-face] JSON parse failed but response looked like YES — accepting', ctx)
        return res.status(200).json({ ok: true, reason: 'verified face' })
      }
      console.error('[check-face] JSON parse failed', { ...ctx, parseErr: parseErr.message })
      return res.status(200).json({
        ok:     false,
        reason: 'Could not verify this photo. Please try a clearer face photo.',
      })
    }

    if (parsed.face === 'yes') {
      return res.status(200).json({ ok: true, reason: 'verified face' })
    }
    if (parsed.face === 'no') {
      console.log('[check-face] rejected', { ...ctx, reason: parsed.reason })
      return res.status(200).json({
        ok:     false,
        reason: parsed.reason || 'Not a usable face photo.',
      })
    }

    console.error('[check-face] unexpected face value', { ...ctx, parsed })
    return res.status(200).json({
      ok:     false,
      reason: 'Could not verify this photo. Please try a clearer face photo.',
    })
  } catch (err) {
    console.error('[check-face] handler error', { ...ctx, err: err?.message, stack: err?.stack?.slice(0, 400) })
    return res.status(200).json({
      ok:     false,
      reason: 'Could not verify this photo. Please try again.',
    })
  }
}
