// api/generate-talk-portrait.js
// Generates a single "talk-with" portrait of the memorial subject from
// 5 reference face photos using Nano-Banana (Gemini 2.5 Flash Image).
//
// POST { memorialId, name, photoUrls: string[] (5 face photos) }
// Side effects:
//   1. Calls Gemini 2.5 Flash Image with all 5 reference photos + a portrait prompt
//   2. Uploads the returned base64 image to Cloudinary
//   3. Writes talkPortraitUrl + talkPortraitAt + talkPortraitStatus='generated' to the memorial
//
// On failure: writes talkPortraitStatus='failed' to the memorial so the UI
// can prompt for re-upload. The face photo URLs themselves are saved by the
// client BEFORE calling this endpoint so they survive failure.

import { init } from '@instantdb/admin'

const GEMINI_MODEL = 'gemini-2.5-flash-image-preview'
const GEMINI_URL   = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`

const PORTRAIT_PROMPT =
  `Using the reference photos provided, generate ONE clean studio-style portrait of the SAME person.

Requirements:
- Square 1:1 aspect ratio
- Soft, flattering natural light (not harsh studio flash)
- Neutral or slightly warm background — paper-cream / soft beige, no busy scenes
- Subject framed from upper chest to top of head
- Face front-and-center, looking softly toward camera
- Match the person's apparent age in the reference photos
- Match their actual features as closely as possible: face shape, hair, skin tone, distinguishing features
- Photorealistic, dignified, suitable for a memorial — quiet, contemplative, warm
- DO NOT stylize, cartoonify, age, or alter the person's identity
- DO NOT add objects, accessories, or text that aren't supported by the references

Return ONLY the generated image.`

// ── Helpers ─────────────────────────────────────────────────────────────────

async function fetchAsBase64(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`Failed to fetch ${url}: ${r.status}`)
  const buf = Buffer.from(await r.arrayBuffer())
  const ct  = r.headers.get('content-type') || 'image/jpeg'
  return { mimeType: ct.split(';')[0].trim(), data: buf.toString('base64') }
}

async function uploadBase64ToCloudinary(base64, folder) {
  const cloudName = process.env.VITE_CLOUDINARY_CLOUD_NAME
  const preset    = process.env.VITE_CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !preset) throw new Error('Cloudinary env not configured')

  const buffer = Buffer.from(base64, 'base64')
  const blob   = new Blob([buffer], { type: 'image/png' })

  const formData = new FormData()
  formData.append('file',          blob, 'talk-portrait.png')
  formData.append('upload_preset', preset)
  formData.append('folder',        folder)

  const r = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData },
  )
  const data = await r.json()
  if (!r.ok) throw new Error(`Cloudinary upload failed: ${data?.error?.message || r.status}`)
  return data.secure_url
}

// ── Handler ─────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY
  const ADMIN_TOKEN    = process.env.INSTANT_APP_ADMIN_TOKEN
  const APP_ID         = process.env.VITE_INSTANT_APP_ID

  if (!GEMINI_API_KEY) return res.status(500).json({ error: 'Gemini API key not configured' })
  if (!ADMIN_TOKEN || !APP_ID) return res.status(500).json({ error: 'InstantDB admin not configured' })

  const { memorialId, name = 'this person', photoUrls = [] } = req.body || {}

  if (!memorialId)               return res.status(400).json({ error: 'memorialId required' })
  if (!Array.isArray(photoUrls) || photoUrls.length < 1)
    return res.status(400).json({ error: 'photoUrls array required (1-5)' })

  const refs = photoUrls.slice(0, 5)                    // cap at 5 references
  const adminDb = init({ appId: APP_ID, adminToken: ADMIN_TOKEN })

  // Mark as pending while we work — UI can show a spinner
  try {
    await adminDb.transact([
      adminDb.tx.memorials[memorialId].update({ talkPortraitStatus: 'pending' }),
    ])
  } catch {}

  try {
    // ── 1. Fetch each reference photo as base64 ──────────────────────────────
    const refImages = await Promise.all(refs.map(fetchAsBase64))

    // ── 2. Build Gemini multimodal request ───────────────────────────────────
    const parts = [
      { text: `${PORTRAIT_PROMPT}\n\nThe person's name is: ${name}` },
      ...refImages.map(img => ({
        inlineData: { mimeType: img.mimeType, data: img.data },
      })),
    ]

    const gemRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        contents: [{ parts }],
        generationConfig: {
          responseModalities: ['IMAGE'],
        },
      }),
    })

    const gemData = await gemRes.json()
    if (!gemRes.ok) {
      console.error('[generate-talk-portrait] Gemini error:', JSON.stringify(gemData).slice(0, 500))
      await adminDb.transact([
        adminDb.tx.memorials[memorialId].update({ talkPortraitStatus: 'failed' }),
      ]).catch(() => {})
      return res.status(gemRes.status).json({
        error: gemData?.error?.message || 'Gemini generation failed',
      })
    }

    // Extract the generated image from the response
    const imgPart = gemData.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)
    const imgB64  = imgPart?.inlineData?.data

    if (!imgB64) {
      console.error('[generate-talk-portrait] No image in Gemini response:',
        JSON.stringify(gemData).slice(0, 500))
      await adminDb.transact([
        adminDb.tx.memorials[memorialId].update({ talkPortraitStatus: 'failed' }),
      ]).catch(() => {})
      return res.status(500).json({ error: 'Gemini did not return an image — possibly a safety block. Try different face photos.' })
    }

    // ── 3. Upload to Cloudinary so we have a persistent URL ──────────────────
    const portraitUrl = await uploadBase64ToCloudinary(imgB64, 'memorials/talk-portraits')

    // ── 4. Persist to memorial via admin SDK ─────────────────────────────────
    await adminDb.transact([
      adminDb.tx.memorials[memorialId].update({
        talkPortraitUrl:    portraitUrl,
        talkPortraitAt:     Date.now(),
        talkPortraitStatus: 'generated',
      }),
    ])

    return res.status(200).json({ ok: true, portraitUrl })
  } catch (err) {
    console.error('[generate-talk-portrait] error:', err)
    await adminDb.transact([
      adminDb.tx.memorials[memorialId].update({ talkPortraitStatus: 'failed' }),
    ]).catch(() => {})
    return res.status(500).json({ error: err?.message || 'Internal error' })
  }
}
