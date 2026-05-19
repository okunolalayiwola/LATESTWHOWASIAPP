// src/lib/elevenlabs.js
// Client-side ElevenLabs integration.
// All API calls go through the Vercel serverless proxy (/api/elevenlabs)
// so the API key stays server-side and is never exposed to the client.
//
// Voice cloning flow:
//   1. Upload a voice recording → get a voice_id from ElevenLabs
//   2. Store voice_id on the memorial record
//   3. To generate speech: call generateSpeech(voiceId, text) → returns audio blob

const PROXY_URL = '/api/elevenlabs'

/**
 * Clone a voice from an audio URL and return the voice ID.
 * Uses ElevenLabs "Instant Voice Cloning" which only needs a single audio sample.
 * @param {string} audioUrl  - Public URL of the uploaded voice recording
 * @param {string} name      - Name for the cloned voice (e.g. "Grace Okonkwo")
 * @returns {Promise<string|null>} The ElevenLabs voice_id, or null on failure
 */
export async function cloneVoice(audioUrl, name) {
  try {
    const response = await fetch(`${PROXY_URL}?action=clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audioUrl, name }),
    })

    if (!response.ok) {
      const err = await response.json()
      console.error('ElevenLabs clone failed:', err)
      return null
    }

    const data = await response.json()
    return data.voice_id
  } catch (err) {
    console.error('ElevenLabs clone error:', err)
    return null
  }
}

/**
 * Generate speech audio from text using a cloned ElevenLabs voice.
 * Returns the audio as a blob that can be played in the browser.
 * @param {string} voiceId  - The ElevenLabs voice_id
 * @param {string} text     - The text to speak
 * @returns {Promise<Blob|null>} Audio blob (MP3 format), or null on failure
 */
export async function generateSpeech(voiceId, text) {
  try {
    const response = await fetch(`${PROXY_URL}?action=speak`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ voiceId, text }),
    })

    if (!response.ok) {
      const err = await response.text()
      console.error('ElevenLabs TTS failed:', err)
      return null
    }

    return await response.blob()
  } catch (err) {
    console.error('ElevenLabs TTS error:', err)
    return null
  }
}

/**
 * Get the remaining character quota for the API key.
 * @returns {Promise<{used: number, remaining: number}|null>}
 */
export async function getQuota() {
  try {
    const response = await fetch(`${PROXY_URL}?action=quota`)
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}
