// src/lib/avatarGenerator.js
// WHO WAS I — AI portrait generation pipeline
//
// Flow:
//   1. photoUrl  → Claude Vision API  → structured appearance details (JSON)
//   2. details   → buildPrompt()      → positive + negative prompt strings
//   3. prompts   → /api/generate-avatar (serverless) → polls Freepik / Stability AI
//   4. imageUrl  → returns to caller  → saved to Cloudinary + InstantDB
//
// The portrait aesthetic (as specified):
//   Ultra-realistic side-profile · bare shoulders dissolving into white mist
//   Eyes closed peacefully · luxury indigenous fashion campaign
//   White seamless background · soft volumetric glow · 8k masterpiece

// ─── Step 1: Analyse photo with Claude Vision ─────────────────────────────────

export async function analysePhoto(photoUrl) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model:      'claude-sonnet-4-20250514',
      max_tokens: 600,
      messages: [{
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'url', url: photoUrl },
          },
          {
            type: 'text',
            text: `Analyse this person's physical appearance for creating a respectful AI portrait.
Describe ONLY what is visible. Respond ONLY with valid JSON — no extra text, no markdown.

{
  "gender": "man | woman | person",
  "ageRange": "young adult | middle-aged | elderly",
  "build": "slender | average | athletic | heavyset | very heavyset",
  "hairColor": "e.g. jet black | silver-white | dark brown with grey streaks",
  "hairLength": "very short | short | medium | long",
  "hairStyle": "e.g. tightly coiled | straight | wavy | locs | natural afro | shaved",
  "skinTone": "e.g. warm golden-brown | deep ebony | olive-brown | porcelain | rich mahogany",
  "heritage": "e.g. West African | South Asian | East Asian | Indigenous Pacific | Northern European | Latin American | Middle Eastern | mixed heritage",
  "facialHair": "none | light stubble | full beard | moustache | goatee",
  "distinctiveFeatures": "e.g. prominent cheekbones | strong jawline | gentle round face | high forehead | deep-set eyes",
  "jewelry": "none | e.g. small gold earrings | nose stud | layered necklaces",
  "culturalMarkings": "none | e.g. traditional Tā moko | henna patterns | ritual scarification",
  "hairAccent": "none | e.g. tips dyed copper | silver streaks | highlighted roots"
}`,
          },
        ],
      }],
    }),
  })

  const data = await res.json()
  const raw  = data.content?.[0]?.text || '{}'

  try {
    // Strip any accidental markdown fences
    const clean = raw.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch {
    return null
  }
}

// ─── Step 2: Build the portrait prompt ───────────────────────────────────────

export function buildPortraitPrompt(details = {}) {
  const {
    gender           = 'person',
    ageRange         = 'middle-aged',
    build            = 'average',
    hairColor        = 'dark hair',
    hairLength       = 'short',
    hairStyle        = 'natural',
    skinTone         = 'warm brown',
    heritage         = 'multicultural',
    facialHair       = 'none',
    distinctiveFeatures = 'gentle features',
    jewelry          = 'none',
    culturalMarkings = 'none',
    hairAccent       = 'none',
  } = details

  // Build descriptive fragments
  const buildDesc = {
    'very heavyset': 'very heavyset ',
    'heavyset':      'heavyset ',
    'athletic':      'athletic ',
    'slender':       'slender ',
    'average':       '',
  }[build] ?? ''

  const hairDesc = [
    hairLength !== 'very short' ? `${hairLength}` : 'very short',
    hairColor,
    hairStyle !== 'natural' ? hairStyle : '',
    hairAccent !== 'none' ? hairAccent : '',
  ].filter(Boolean).join(' ')

  const facialHairDesc = facialHair !== 'none' ? `, ${facialHair}` : ''
  const markingsDesc   = culturalMarkings !== 'none' ? `, subtle ${culturalMarkings}` : ''
  const jewelryDesc    = jewelry !== 'none' ? `, ${jewelry}` : ''

  const subject = `${buildDesc}${heritage} ${ageRange} ${gender} with ${hairDesc}${facialHairDesc}, ${distinctiveFeatures}${markingsDesc}${jewelryDesc}`

  const positive = [
    `Ultra realistic side-profile portrait of a ${subject}`,
    'bare shoulders softly disappearing into white mist',
    'no clothing visible',
    'emerging from pure white negative space',
    'eyes closed peacefully',
    'soft ethereal atmosphere',
    `hyper detailed ${skinTone} skin texture`,
    'subtle cinematic rim lighting around the hair and jawline',
    'minimal futuristic luxury aesthetic',
    'elegant neck dissolving into fog and white light',
    'high-key photography',
    'dreamlike diffusion',
    'soft volumetric glow',
    'luxury fashion campaign aesthetic',
    'ultra clean composition',
    'centered portrait',
    'realistic pores and anatomy',
    'premium editorial photography style',
    'shallow depth of field',
    'photorealistic',
    'medium format photography',
    '8k',
    'masterpiece',
    'emotionally calm and transcendent',
    'white seamless background',
    'subtle bloom lighting',
    'soft gaussian diffusion',
    'cinematic soft light',
    'fine art portraiture',
  ].join(', ')

  const negative = [
    'clothing', 'fabric', 'shirt', 'dress', 'jacket',
    'fantasy warrior costume', 'cartoon', 'anime',
    'distorted anatomy', 'deformed face', 'extra limbs',
    'low quality', 'blurry', 'pixelated',
    'text', 'watermark', 'signature', 'logo',
    'dark background', 'colored background', 'harsh shadows',
    'fake tribal tattoos', 'painted face', 'heavy makeup',
    'dramatic color grading', 'oversaturated',
  ].join(', ')

  return { positive, negative, subjectSummary: subject }
}

// ─── Step 3: Call serverless generation endpoint ─────────────────────────────

export async function generatePortrait(positive, negative, onProgress) {
  onProgress?.('Queuing generation…', 10)

  const res = await fetch('/api/generate-avatar', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ positive, negative }),
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Generation failed')
  }

  const { taskId, imageUrl } = await res.json()

  // If the API returns an image URL immediately (sync), return it
  if (imageUrl) {
    onProgress?.('Portrait ready', 100)
    return imageUrl
  }

  // Otherwise poll for completion
  if (taskId) {
    return pollForResult(taskId, onProgress)
  }

  throw new Error('No task ID or image URL returned')
}

async function pollForResult(taskId, onProgress, attempts = 0) {
  if (attempts > 40) throw new Error('Generation timed out after 2 minutes')

  onProgress?.(`Generating portrait… ${Math.min(20 + attempts * 2, 90)}%`, Math.min(20 + attempts * 2, 90))

  await new Promise(r => setTimeout(r, 3000))

  const res  = await fetch(`/api/generate-avatar?taskId=${taskId}`)
  const data = await res.json()

  if (data.status === 'completed' && data.imageUrl) {
    onProgress?.('Portrait ready', 100)
    return data.imageUrl
  }

  if (data.status === 'failed') {
    throw new Error(data.error || 'Generation failed')
  }

  return pollForResult(taskId, onProgress, attempts + 1)
}

// ─── Convenience: full pipeline in one call ───────────────────────────────────

export async function generateFromPhoto(photoUrl, onProgress) {
  onProgress?.('Analysing photo…', 5)
  const details = await analysePhoto(photoUrl)
  if (!details) throw new Error('Could not analyse photo')

  onProgress?.('Building portrait prompt…', 20)
  const { positive, negative, subjectSummary } = buildPortraitPrompt(details)

  onProgress?.('Starting generation…', 25)
  const imageUrl = await generatePortrait(positive, negative, onProgress)

  return { imageUrl, details, subjectSummary, positive, negative }
}

// ─── Manual build (no photo — use text inputs) ────────────────────────────────

export function generateFromDetails(manualDetails) {
  return buildPortraitPrompt(manualDetails)
}
