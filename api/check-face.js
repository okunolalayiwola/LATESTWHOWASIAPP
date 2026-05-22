// api/check-face.js
// Quick face-validation for the talk-portrait training upload.
// Uses Claude Haiku vision (cheap + fast — ~$0.001 / call, sub-2s).
//
// POST { photoUrl }
// Returns: { ok: boolean, reason: string }
//
// "ok" = photo contains a clear, well-lit human face suitable for portrait
// generation by Nano-Banana. Bad inputs (blurry, no face, sunglasses,
// extreme angles, multiple people) are rejected with an actionable reason.

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

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-haiku-4-5',   // cheap + fast, plenty for binary judgment
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'url', url: photoUrl } },
            {
              type: 'text',
              text:
                `Is this photo usable as a face reference for AI portrait generation? It needs:
- ONE human face, clearly visible and well-lit
- Eyes open (or visible)
- No heavy sunglasses/mask covering the face
- Reasonably sharp (not severely blurred)
- The face takes up enough of the frame (not a tiny dot)

Reply STRICTLY in this format on a single line:
OK: <brief reason>     — if usable
BAD: <brief reason>    — if not usable

Examples:
OK: clear front-facing portrait
BAD: face is blurry
BAD: no face visible
BAD: multiple people, can't tell which one
BAD: sunglasses cover eyes`,
            },
          ],
        }],
      }),
    })

    const data = await r.json()
    if (!r.ok) {
      console.error('[check-face] Claude error:', data)
      // Don't block uploads on a Claude outage — degrade gracefully
      return res.status(200).json({ ok: true, reason: 'pre-check skipped (model unavailable)' })
    }

    const raw = (data.content?.[0]?.text || '').trim()
    if (raw.toUpperCase().startsWith('OK')) {
      return res.status(200).json({ ok: true, reason: raw.slice(3).replace(/^[:\s]+/, '') })
    }
    if (raw.toUpperCase().startsWith('BAD')) {
      return res.status(200).json({ ok: false, reason: raw.slice(4).replace(/^[:\s]+/, '') || 'not usable for portrait generation' })
    }
    // Ambiguous response — let it through rather than blocking a real user
    return res.status(200).json({ ok: true, reason: 'pre-check inconclusive' })
  } catch (err) {
    console.error('[check-face] error:', err)
    // Degrade gracefully — don't block uploads on a network blip
    return res.status(200).json({ ok: true, reason: 'pre-check skipped (network error)' })
  }
}
