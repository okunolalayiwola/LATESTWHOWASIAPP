// api/vault-reset.js
// POST { email, code, memorialName }
//   → emails a 6-digit vault PIN reset code to the account email address.
//
// The CODE itself is generated client-side (vaultAuth.requestPINReset) and
// only its hash is stored locally; this endpoint just delivers it to the
// user's inbox. We verify the email belongs to a real account before sending.
//
// Env: RESEND_API_KEY, INSTANTDB_ADMIN_TOKEN
// Matches the existing pattern in api/send-anniversary.js.

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const { email, code, memorialName } = req.body || {}

  if (!email || !code || !/^\d{6}$/.test(String(code))) {
    res.status(400).json({ error: 'Missing or invalid email/code' })
    return
  }

  // Verify the email belongs to an actual account (don't email arbitrary
  // addresses). InstantDB admin query against $users.
  try {
    const q = await fetch('https://api.instantdb.com/admin/query', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}`,
      },
      body: JSON.stringify({
        query: { $users: { $: { where: { email: String(email).toLowerCase() } } } },
      }),
    })
    const result = await q.json()
    const exists = (result?.$users || []).length > 0
    if (!exists) {
      // Respond 200 anyway so we don't leak which emails are registered.
      res.status(200).json({ ok: true })
      return
    }
  } catch {
    // If the lookup fails, fail closed but don't leak details.
    res.status(200).json({ ok: true })
    return
  }

  const safeName = (memorialName || 'your Legacy Vault').slice(0, 80)

  try {
    await resend.emails.send({
      from: 'WHO WAS I <admin@whowasi.uk>',
      to: String(email),
      subject: 'Your Legacy Vault PIN reset code',
      html: `
        <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#0d0d12;border-radius:16px;color:#fff">
          <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#FFD700;margin:0 0 8px">WHO WAS I · Legacy Vault</p>
          <h1 style="font-size:22px;margin:0 0 16px;color:#fff">Reset your vault PIN</h1>
          <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.65);margin:0 0 24px">
            You asked to reset the PIN for <strong style="color:#fff">${safeName}</strong>.
            Enter this code in the app to set a new PIN:
          </p>
          <div style="background:rgba(255,215,0,.10);border:1px solid rgba(255,215,0,.25);border-radius:12px;padding:20px;text-align:center;margin:0 0 24px">
            <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#FFD700">${code}</span>
          </div>
          <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,.4);margin:0">
            This code expires in 15 minutes. If you didn't request this, you can
            safely ignore this email — your vault stays locked and unchanged.
          </p>
        </div>
      `,
    })
    res.status(200).json({ ok: true })
  } catch (err) {
    res.status(500).json({ error: 'Could not send reset email' })
  }
}
