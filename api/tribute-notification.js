// api/tribute-notification.js
// POST { memorialId, tributeText, tributeType, authorName }
// Env: RESEND_API_KEY, INSTANTDB_ADMIN_TOKEN

import { Resend } from 'resend'

const resend   = new Resend(process.env.RESEND_API_KEY)
const APP      = 'https://whowasi.uk'
const throttle = new Map()   // memorial → last email timestamp

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  const { memorialId, tributeText, tributeType, authorName } = req.body
  if (!memorialId) return res.status(400).json({ error:'Missing memorialId' })

  // Rate-limit: one email per memorial per 10 minutes
  const last = throttle.get(memorialId)
  if (last && Date.now() - last < 600_000) return res.json({ skipped:true })

  let memorial=null, ownerEmail=null
  try {
    const r1 = await fetch('https://api.instantdb.com/admin/query', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
      body:JSON.stringify({ query:{ memorials:{ $:{ where:{ id:memorialId } } } } })
    })
    memorial = (await r1.json())?.memorials?.[0]
    if (!memorial?.creatorId) return res.json({ skipped:true })

    const r2 = await fetch('https://api.instantdb.com/admin/query', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
      body:JSON.stringify({ query:{ $users:{ $:{ where:{ id:memorial.creatorId } } } } })
    })
    ownerEmail = (await r2.json())?.$users?.[0]?.email
  } catch { return res.status(500).json({ error:'DB error' }) }

  if (!ownerEmail) return res.json({ skipped:true })

  const typeLabel = { candle:'lit a candle', memory:'shared a memory', tribute:'left a tribute' }[tributeType] || 'left a tribute'
  const typeEmoji = { candle:'🕯', memory:'◎', tribute:'♡' }[tributeType] || '♡'
  const memUrl    = `${APP}/memorial/${memorialId}`

  try {
    await resend.emails.send({
      from:    'WHO WAS I <admin@whowasi.uk>',
      to:      [ownerEmail],
      subject: `${authorName || 'Someone'} ${typeLabel} on ${memorial.name}'s memorial`,
      html:`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#08080f;font-family:Georgia,serif;color:#fff">
<div style="max-width:520px;margin:0 auto;padding:40px 20px">
  <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,215,0,.65);margin:0 0 28px">WHO WAS I · whowasi.uk</p>
  <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:28px;margin-bottom:20px">
    <p style="margin:0 0 4px;font-size:13px;color:rgba(255,255,255,.4)">${typeEmoji} ${authorName || 'Someone'} ${typeLabel} on</p>
    <p style="margin:0 0 20px;font-size:24px;font-weight:700;color:#fff">${memorial.name}</p>
    ${tributeText ? `<div style="background:rgba(255,255,255,.04);border-left:3px solid rgba(255,215,0,.4);border-radius:0 12px 12px 0;padding:14px 16px">
      <p style="margin:0;font-size:15px;color:rgba(255,255,255,.72);line-height:1.6;font-style:italic">"${tributeText}"</p>
    </div>` : ''}
  </div>
  <div style="text-align:center;margin-bottom:28px">
    <a href="${memUrl}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#38BDF8);color:#000;font-weight:700;font-size:13px;padding:12px 28px;border-radius:100px;text-decoration:none">View on memorial →</a>
  </div>
  <p style="text-align:center;font-size:11px;color:rgba(255,255,255,.2)">
    <a href="${APP}/settings" style="color:rgba(255,215,0,.35);text-decoration:none">Unsubscribe</a>
  </p>
</div></body></html>`
    })
    throttle.set(memorialId, Date.now())
    return res.json({ sent:true })
  } catch (err) {
    return res.status(500).json({ error:err.message })
  }
}
