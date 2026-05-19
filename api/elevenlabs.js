// api/elevenlabs.js
// Vercel serverless function that proxies ElevenLabs API calls.
// This keeps the API key server-side (not exposed to the client).
//
// Endpoints:
//   POST /api/elevenlabs?action=clone   — Clone a voice from an audio URL
//   POST /api/elevenlabs?action=speak   — Generate speech from text using a cloned voice
//   GET  /api/elevenlabs?action=quota   — Get remaining character quota

const ELEVENLABS_API_KEY = process.env.ELEVENLABS_API_KEY
const BASE_URL = 'https://api.elevenlabs.io/v1'

export default async function handler(req, res) {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') {
    return res.status(200).end()
  }

  if (!ELEVENLABS_API_KEY) {
    return res.status(500).json({ error: 'ElevenLabs API key not configured' })
  }

  const { action } = req.query

  try {
    switch (action) {
      // ── Clone voice ──────────────────────────────────────────────────────
      case 'clone': {
        const { audioUrl, name } = req.body
        if (!audioUrl) return res.status(400).json({ error: 'audioUrl is required' })

        // Download the audio file
        const audioResponse = await fetch(audioUrl)
        if (!audioResponse.ok) return res.status(400).json({ error: 'Failed to download audio file' })
        const blob = await audioResponse.blob()

        // Build form data for ElevenLabs
        const formData = new FormData()
        formData.append('name', name || 'Memorial Voice')
        formData.append('files', blob, 'voice.webm')

        const result = await fetch(`${BASE_URL}/voices/add`, {
          method: 'POST',
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
          body: formData,
        })

        if (!result.ok) {
          const err = await result.text()
          return res.status(result.status).json({ error: err })
        }

        const data = await result.json()
        return res.status(200).json({ voice_id: data.voice_id })
      }

      // ── Generate speech ──────────────────────────────────────────────────
      case 'speak': {
        const { voiceId, text } = req.body
        if (!voiceId || !text) return res.status(400).json({ error: 'voiceId and text are required' })

        const response = await fetch(`${BASE_URL}/text-to-speech/${voiceId}`, {
          method: 'POST',
          headers: {
            'xi-api-key': ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_monolingual_v1',
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              style: 0.3,
              use_speaker_boost: true,
            },
          }),
        })

        if (!response.ok) {
          const err = await response.text()
          return res.status(response.status).json({ error: err })
        }

        // Return audio as binary
        const audioBuffer = await response.arrayBuffer()
        res.setHeader('Content-Type', 'audio/mpeg')
        res.setHeader('Content-Length', audioBuffer.byteLength)
        return res.status(200).send(Buffer.from(audioBuffer))
      }

      // ── Get quota ────────────────────────────────────────────────────────
      case 'quota': {
        const response = await fetch(`${BASE_URL}/user`, {
          headers: { 'xi-api-key': ELEVENLABS_API_KEY },
        })
        if (!response.ok) return res.status(response.status).json({ error: 'Failed to get quota' })
        const data = await response.json()
        return res.status(200).json({
          used: data.subscription.character_count || 0,
          remaining: data.subscription.character_limit - data.subscription.character_count || 0,
        })
      }

      default:
        return res.status(400).json({ error: 'Invalid action. Use clone, speak, or quota.' })
    }
  } catch (err) {
    console.error('ElevenLabs proxy error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
