// api/report-tribute.js
// POST { tributeId, tributeText, authorName, memorialName, reason, note }
// Env: RESEND_API_KEY

import { Resend } from 'resend'
const resend = new Resend(process.env.RESEND_API_KEY)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { tributeId, tributeText, authorName, memorialName, reason, note } = req.body
  if (!reason) return res.status(400).json({ error:'Missing reason' })

  try {
    await resend.emails.send({
      from:    'WHO WAS I <admin@whowasi.uk>',
      to:      ['admin@whowasi.uk'],
      subject: `[Report] Tribute on "${memorialName}" — ${reason}`,
      html:`<div style="font-family:sans-serif;max-width:500px;padding:20px">
  <h2 style="color:#e53e3e">Tribute Reported</h2>
  <table style="width:100%;border-collapse:collapse">
    <tr><td style="padding:8px 0;color:#666;width:120px">Memorial</td><td style="font-weight:600">${memorialName}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Tribute ID</td><td style="font-family:monospace;font-size:12px">${tributeId}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Author</td><td>${authorName || 'Anonymous'}</td></tr>
    <tr><td style="padding:8px 0;color:#666">Reason</td><td style="color:#e53e3e;font-weight:600">${reason}</td></tr>
  </table>
  ${tributeText ? `<div style="margin:16px 0;padding:12px;background:#f5f5f5;border-left:4px solid #e53e3e;border-radius:4px"><p style="margin:0">${tributeText}</p></div>` : ''}
  ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}
</div>`
    })
    return res.json({ ok:true })
  } catch (err) {
    return res.status(500).json({ error:err.message })
  }
}
