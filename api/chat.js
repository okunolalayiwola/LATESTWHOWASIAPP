// api/chat.js
// Vercel serverless function — proxies Anthropic Claude API.
// The API key is NEVER sent to the browser; all calls go through here.
//
// POST /api/chat
// Body: { messages: [{ role, content }], system: string, maxTokens?: number }
// Returns: { text: string }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')    return res.status(405).json({ error: 'Method not allowed' })

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY
  if (!ANTHROPIC_API_KEY)
    return res.status(500).json({ error: 'Anthropic API key not configured on server' })

  const { messages, system, maxTokens = 300 } = req.body || {}

  if (!Array.isArray(messages) || !messages.length)
    return res.status(400).json({ error: 'messages array is required' })
  if (!system)
    return res.status(400).json({ error: 'system prompt is required' })

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-20250514',
        max_tokens: maxTokens,
        system,
        messages:   messages.map(m => ({ role: m.role, content: m.content })),
      }),
    })

    const data = await r.json()

    if (!r.ok)
      return res.status(r.status).json({ error: data?.error?.message || 'Claude API error' })

    return res.status(200).json({
      text: data.content?.[0]?.text || "I'm here with you, always.",
    })
  } catch (err) {
    console.error('Chat proxy error:', err)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
