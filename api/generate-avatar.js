// api/generate-avatar.js
// Vercel serverless function — AI portrait generation
//
// Primary:  Freepik AI text-to-image API
// Fallback: Stability AI (Stable Diffusion)
//
// Environment variables needed in Vercel dashboard:
//   FREEPIK_API_KEY       = your Freepik API key (from app.freepik.com/api)
//   STABILITY_API_KEY     = your Stability AI key (optional fallback)
//
// GET  /api/generate-avatar?taskId=xxx   → poll for Freepik async result
// POST /api/generate-avatar              → start new generation

export default async function handler(req, res) {

  // ── Poll for existing task (Freepik is async) ────────────────────────────
  if (req.method === 'GET') {
    const { taskId } = req.query
    if (!taskId) return res.status(400).json({ error: 'Missing taskId' })

    const poll = await fetch(
      `https://api.freepik.com/v1/ai/text-to-image/${taskId}`,
      { headers: { 'X-Freepik-API-Key': process.env.FREEPIK_API_KEY } }
    )
    const data = await poll.json()

    if (data.data?.status === 'completed') {
      // Freepik returns base64 images inside data.data.generated[]
      const b64 = data.data.generated?.[0]?.base64
      if (b64) {
        return res.json({
          status:   'completed',
          imageUrl: `data:image/jpeg;base64,${b64}`,
        })
      }
    }

    if (data.data?.status === 'failed') {
      return res.json({ status: 'failed', error: 'Freepik generation failed' })
    }

    return res.json({ status: data.data?.status || 'processing' })
  }

  // ── Start new generation ──────────────────────────────────────────────────
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { positive, negative } = req.body
  if (!positive) return res.status(400).json({ error: 'Missing positive prompt' })

  // ── Try Freepik first ─────────────────────────────────────────────────────
  if (process.env.FREEPIK_API_KEY) {
    try {
      const freepikRes = await fetch('https://api.freepik.com/v1/ai/text-to-image', {
        method:  'POST',
        headers: {
          'Content-Type':    'application/json',
          'X-Freepik-API-Key': process.env.FREEPIK_API_KEY,
        },
        body: JSON.stringify({
          prompt: positive,
          negative_prompt: negative,
          guidance_scale: 7,
          seed:           -1,           // random seed each time
          num_images:     1,
          image: {
            size: 'square_1_1',         // 1:1 for portrait
          },
          styling: {
            style:  'photo',            // photorealistic
            color:  'pastel',           // soft, not garish
            lighting: 'studio',         // clean studio light
          },
        }),
      })

      const freepikData = await freepikRes.json()

      // Freepik can return immediately (sync) or as a task (async)
      if (freepikData.data?.status === 'completed') {
        const b64 = freepikData.data?.generated?.[0]?.base64
        if (b64) {
          return res.json({ imageUrl: `data:image/jpeg;base64,${b64}` })
        }
      }

      // Async task — return task ID for polling
      if (freepikData.data?.task_id || freepikData.data?.id) {
        return res.json({ taskId: freepikData.data.task_id || freepikData.data.id })
      }

    } catch (freepikErr) {
      console.error('[Freepik] error:', freepikErr.message)
      // Fall through to Stability AI
    }
  }

  // ── Stability AI fallback ─────────────────────────────────────────────────
  if (process.env.STABILITY_API_KEY) {
    try {
      const stabRes = await fetch(
        'https://api.stability.ai/v2beta/stable-image/generate/ultra',
        {
          method:  'POST',
          headers: {
            Authorization: `Bearer ${process.env.STABILITY_API_KEY}`,
            Accept:        'image/*',
          },
          body: (() => {
            const fd = new FormData()
            fd.append('prompt',          positive)
            fd.append('negative_prompt', negative)
            fd.append('aspect_ratio',    '1:1')
            fd.append('output_format',   'jpeg')
            fd.append('seed',            '0')
            return fd
          })(),
        }
      )

      if (stabRes.ok) {
        const buffer = await stabRes.arrayBuffer()
        const b64    = Buffer.from(buffer).toString('base64')
        return res.json({ imageUrl: `data:image/jpeg;base64,${b64}` })
      }

    } catch (stabErr) {
      console.error('[Stability] error:', stabErr.message)
    }
  }

  return res.status(500).json({
    error: 'No generation service available. Set FREEPIK_API_KEY or STABILITY_API_KEY in Vercel.',
  })
}
