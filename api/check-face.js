// api/check-face.js
// Face validation for the talk-portrait training upload.
//
// POST { photoUrl }
// Returns: { ok: boolean, reason: string }
//
// "ok" = photo contains ONE clear, well-lit, real human face suitable for
// portrait generation. Bad inputs (drawings, objects, animals, landscapes,
// blurry shots, sunglasses, multi-person shots, no-face shots) are rejected
// with an actionable reason.
//
// IMPORTANT DESIGN: this endpoint FAILS CLOSED. If the vision model can't
// be reached, the response is malformed, or anything else goes wrong, the
// photo is REJECTED — never silently accepted. The user is asked to try
// again. A validation gate that defaults to "let it through" is no gate.

const MODEL = 'claude-haiku-4-5'   // Haiku 4.5 — cheap, fast, vision-capable

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

  const RULES = `You are a strict gatekeeper for face reference photos.

REJECT this photo unless ALL of these are true:
1. It shows a REAL human face — not a drawing, painting, cartoon, illustration, sculpture, statue, doll, mannequin, animal, or AI-generated image.
2. Exactly ONE face is the clear main subject (not multiple people, not a face hidden in a crowd).
3. The face is well-lit and clearly visible — not severely blurred, dark, overexposed, or pixelated.
4. The face fills a reasonable portion of the frame — not a tiny dot in a wide landscape.
5. Eyes are visible — no heavy sunglasses, mask, or hand covering most of the face.
6. The photo is not just text, an object (car, food, building), a landscape, an animal, a body part without a face, or abstract art.

If ANY of these fail → "face": "no" with a brief, specific reason (e.g. "this is a drawing, not a real photo", "no face visible — this looks like a landscape", "multiple people in the photo", "face is too blurry to use").

Respond with ONLY a JSON object, no other text. Format:
{"face":"yes"}  OR  {"face":"no","reason":"..."}`

  let claudeStatus = 0
  let raw = ''
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      MODEL,
        max_tokens: 120,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'url', url: photoUrl } },
              { type: 'text',  text: RULES },
            ],
          },
          // Prefill the assistant turn with "{" so the response is forced to be
          // a JSON object continuing from that brace — no preamble, no markdown.
          { role: 'assistant', content: '{' },
        ],
      }),
    })

    claudeStatus = r.status
    const data    = await r.json()

    if (!r.ok) {
      console.error('[check-face] Claude error', claudeStatus, JSON.stringify(data).slice(0, 300))
      // FAIL CLOSED: reject so the user retries.
      return res.status(200).json({
        ok:     false,
        reason: 'Could not verify this photo. Please try again in a moment.',
      })
    }

    raw = (data.content?.[0]?.text || '').trim()
    // Re-add the prefilled "{" that Claude was forced to continue from
    const jsonStr = raw.startsWith('{') ? raw : `{${raw}`

    // Strip anything after the closing brace (defensive — sometimes models add trailing text)
    const lastBrace = jsonStr.lastIndexOf('}')
    const cleanJson = lastBrace > 0 ? jsonStr.slice(0, lastBrace + 1) : jsonStr

    const parsed = JSON.parse(cleanJson)

    if (parsed.face === 'yes') {
      return res.status(200).json({ ok: true, reason: 'verified face' })
    }
    if (parsed.face === 'no') {
      return res.status(200).json({
        ok:     false,
        reason: parsed.reason || 'Not a usable face photo.',
      })
    }

    // Unexpected value in "face" field — fail closed
    console.error('[check-face] unexpected face value:', parsed)
    return res.status(200).json({
      ok:     false,
      reason: 'Could not verify this photo. Please try a clearer face photo.',
    })
  } catch (err) {
    console.error('[check-face] error', { claudeStatus, raw: raw.slice(0, 200), err: err?.message })
    // FAIL CLOSED on parse errors, network blips, anything unexpected.
    return res.status(200).json({
      ok:     false,
      reason: 'Could not verify this photo. Please try again.',
    })
  }
}
