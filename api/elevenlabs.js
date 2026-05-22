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
        // remove_background_noise: cleans up amateur recordings (kitchen hum,
        // air conditioner, traffic) before training the voice clone — gives
        // the model a clean signal to learn from.
        const formData = new FormData()
        formData.append('name',                    name || 'Memorial Voice')
        formData.append('files',                   blob, 'voice.webm')
        formData.append('remove_background_noise', 'true')
        formData.append('description',             'Personal memorial voice — preserved by family on WHO WAS I.')

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

        // Model + settings tuned for HUMAN-SOUNDING memorial voice.
        //
        // model_id: eleven_multilingual_v2 — the current state-of-the-art for
        //   clone fidelity + multi-language support. Replaces the deprecated
        //   eleven_monolingual_v1 which was English-only and noticeably more
        //   robotic. v2 handles French/Spanish/Yoruba/etc. for our
        //   language-adaptive AI replies.
        //
        // stability: 0.45 — slightly under the middle. Lower = more emotional
        //   variation between sentences (which makes the voice feel alive,
        //   not monotone). Higher = consistent but flatter. 0.45 is the
        //   sweet spot for a person remembering their life.
        //
        // similarity_boost: 0.85 — pushes the output closer to the cloned
        //   voice. Bumped from 0.75 because the previous output had a
        //   "generic narrator" quality. 0.85 keeps the person's actual timbre.
        //
        // style: 0.45 — adds warmth and expressive inflection. Was 0.3 (a
        //   little flat). 0.45 lets emotional sentences carry weight without
        //   over-acting.
        //
        // use_speaker_boost: true — keeps. Enhances output clarity.
        //
        // output_format=mp3_44100_192 — query param. Default is 128 kbps;
        //   192 is a clear-ish upgrade for emotional moments where breath
        //   and texture matter.
        const ttsUrl = `${BASE_URL}/text-to-speech/${voiceId}?output_format=mp3_44100_192`
        const response = await fetch(ttsUrl, {
          method: 'POST',
          headers: {
            'xi-api-key':   ELEVENLABS_API_KEY,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text,
            model_id: 'eleven_multilingual_v2',
            voice_settings: {
              stability:         0.45,
              similarity_boost:  0.85,
              style:             0.45,
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
