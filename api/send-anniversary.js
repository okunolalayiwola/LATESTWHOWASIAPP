// api/send-anniversary.js
// Vercel Cron — runs 09:00 UTC daily  (set in vercel.json)
// Sends birthday and death-anniversary reminder emails to memorial owners.
// From: admin@whowasi.uk  (Hostinger — verify domain in Resend dashboard)
// npm install resend
// Env: RESEND_API_KEY, INSTANTDB_ADMIN_TOKEN, CRON_SECRET

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP    = 'https://whowasi.uk'

export default async function handler(req, res) {
  // Protect endpoint — Vercel sends the CRON_SECRET automatically in production
  const auth = req.headers.authorization
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const today = new Date()
  const mon   = today.getMonth() + 1
  const day   = today.getDate()

  let memorials = []
  try {
    const r = await fetch('https://api.instantdb.com/admin/query', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
      body:JSON.stringify({ query:{ memorials:{}, profiles:{} } })
    })
    memorials = (await r.json())?.memorials || []
  } catch (err) {
    return res.status(500).json({ error: 'DB fetch failed' })
  }

  const sent=[], errors=[]

  for (const m of memorials) {
    const events = []

    // Death anniversary
    if (m.dod) {
      const d = new Date(m.dod)
      const yrs = today.getFullYear() - d.getFullYear()
      if (d.getMonth()+1 === mon && d.getDate() === day && yrs > 0) {
        events.push({ label: yrs === 1 ? 'One year ago today' : `${yrs} years ago today`, detail:`${m.name} passed away on this day.` })
      }
    }

    // Birthday
    if (m.dob) {
      const d = new Date(m.dob)
      const age = today.getFullYear() - d.getFullYear()
      if (d.getMonth()+1 === mon && d.getDate() === day) {
        events.push({ label: m.alive !== false ? 'Happy Birthday 🎂' : `Would have been ${age}`, detail:`${m.name}'s birthday is today.` })
      }
    }

    if (!events.length || !m.creatorId) continue

    // Get creator email
    let email = null
    try {
      const ur = await fetch('https://api.instantdb.com/admin/query', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
        body:JSON.stringify({ query:{ $users:{ $:{ where:{ id:m.creatorId } } } } })
      })
      email = (await ur.json())?.$users?.[0]?.email
    } catch { continue }

    if (!email) continue

    const url = `${APP}/memorial/${m.id}`

    try {
      const { data } = await resend.emails.send({
        from:    'WHO WAS I <admin@whowasi.uk>',
        to:      [email],
        subject: `${events[0].label} — ${m.name}`,
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#08080f;font-family:Georgia,serif;color:#fff">
<div style="max-width:540px;margin:0 auto;padding:40px 20px">
  <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,215,0,.65);margin:0 0 28px">WHO WAS I · whowasi.uk</p>
  <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:28px;margin-bottom:20px">
    ${m.photo ? `<img src="${m.photo}" style="width:100%;height:200px;object-fit:cover;object-position:center top;border-radius:12px;display:block;margin-bottom:20px">` : ''}
    ${events.map(e => `<p style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,215,0,.7);margin:0 0 6px">${e.label}</p>
    <p style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.2">${m.name}</p>
    <p style="font-size:14px;color:rgba(255,255,255,.5);margin:0 0 16px">${e.detail}</p>`).join('')}
  </div>
  <div style="text-align:center;margin-bottom:28px">
    <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#38BDF8);color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:100px;text-decoration:none">
      ✦ Visit their memorial
    </a>
  </div>
  <p style="text-align:center;font-size:11px;color:rgba(255,255,255,.2)">
    WHO WAS I · <a href="${APP}" style="color:rgba(255,215,0,.4);text-decoration:none">whowasi.uk</a>
  </p>
</div></body></html>`
      })
      sent.push({ name:m.name, email, id:data?.id })
    } catch (e) {
      errors.push({ name:m.name, error:e.message })
    }
  }

  return res.json({ sent:sent.length, errors:errors.length, details:sent })
}
