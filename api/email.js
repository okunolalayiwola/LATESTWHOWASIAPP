// api/email.js — Consolidated email handler
// POST /api/email  { action, ...params }
// Actions: tribute-notification | vault-share-pin | vault-reset |
//          family-connection-request | family-connection-approved |
//          report-tribute | send-anniversary
//
// Env: RESEND_API_KEY, INSTANTDB_ADMIN_TOKEN, CRON_SECRET

import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const APP    = process.env.NEXT_PUBLIC_APP_URL || 'https://whowasi.uk'

// ── Helpers ──────────────────────────────────────────────────────────────────

async function instantQuery(query) {
  const r = await fetch('https://api.instantdb.com/admin/query', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}`,
    },
    body: JSON.stringify({ query }),
  })
  return r.json()
}

function buildHtml(blocks) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8" /><style>
  body { font-family: Inter, Arial, sans-serif; background: #f7f3ea; color: #15120e; margin: 0; padding: 0; }
  .wrap { max-width: 520px; margin: 0 auto; background: #fff; border-radius: 16px; overflow: hidden; }
  .header { background: #08080f; padding: 28px 32px; text-align: center; }
  .logo { color: #f3b21a; font-size: 18px; font-weight: 700; letter-spacing: 0.1em; }
  .body { padding: 32px; }
  .footer { background: #f7f3ea; padding: 20px 32px; font-size: 11px; color: #948a7a; text-align: center; }
</style></head>
<body>
<div class="wrap">
  <div class="header"><div class="logo">WHO WAS I</div></div>
  <div class="body">${blocks.body || ''}</div>
  <div class="footer">${blocks.footer || 'WHO WAS I · Living Memorial Platform · whowasi.uk'}</div>
</div>
</body>
</html>`.trim()
}

// ── Action handlers ──────────────────────────────────────────────────────────

const actions = {

  // ── Tribute notification ────────────────────────────────────────────────
  async 'tribute-notification'(body) {
    const { memorialId, tributeText, tributeType, authorName } = body
    if (!memorialId) return { status: 400, json: { error: 'Missing memorialId' } }

    let memorial = null, ownerEmail = null
    try {
      const r1 = await instantQuery({ memorials: { $: { where: { id: memorialId } } } })
      memorial = r1?.memorials?.[0]
      if (!memorial?.creatorId) return { json: { skipped: true } }

      const r2 = await instantQuery({ $users: { $: { where: { id: memorial.creatorId } } } })
      ownerEmail = r2?.$users?.[0]?.email
    } catch { return { status: 500, json: { error: 'DB error' } } }

    if (!ownerEmail) return { json: { skipped: true } }

    const typeLabel = { candle: 'lit a candle', memory: 'shared a memory', tribute: 'left a tribute' }[tributeType] || 'left a tribute'
    const typeEmoji = { candle: '🕯', memory: '◎', tribute: '♡' }[tributeType] || '♡'
    const memUrl = `${APP}/memorial/${memorialId}`

    await resend.emails.send({
      from: 'WHO WAS I <admin@whowasi.uk>',
      to: [ownerEmail],
      subject: `${authorName || 'Someone'} ${typeLabel} on ${memorial.name}'s memorial`,
      html: buildHtml({
        body: `
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
          </p>`,
        footer: 'WHO WAS I · whowasi.uk',
      }),
    })
    return { json: { sent: true } }
  },

  // ── Vault share PIN ─────────────────────────────────────────────────────
  async 'vault-share-pin'(body) {
    const { senderName, memorialName, pin, recipients } = body
    if (!pin || !Array.isArray(recipients) || recipients.length === 0) {
      return { status: 400, json: { error: 'Missing required fields' } }
    }
    if (!/^\d{6}$/.test(String(pin))) {
      return { status: 400, json: { error: 'Invalid PIN format' } }
    }

    const vaultUrl = `${APP}/memorial`
    const errors = []

    for (const recipient of recipients) {
      if (!recipient.email) continue
      try {
        const resp = await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            from: 'WHO WAS I <noreply@whowasi.uk>',
            to: [recipient.email],
            subject: `🔒 Vault code for ${memorialName || 'the memorial'} — WHO WAS I`,
            html: buildHtml({
              body: `
                <h2>🔒 Vault access shared with you</h2>
                <p>Hi <strong>${recipient.name || 'there'}</strong>,</p>
                <p><strong>${senderName || 'A family member'}</strong> has shared the Legacy Vault code for <strong>${memorialName || 'a WHO WAS I memorial'}</strong> with you.</p>
                <p>Use the code below to open the vault on the memorial page:</p>
                <div style="background:#08080f;border-radius:16px;padding:28px;text-align:center;border:1px solid rgba(243,178,26,.25);margin:24px 0">
                  <div style="font-size:11px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:rgba(243,178,26,.6);margin-bottom:10px">◆ Vault PIN</div>
                  <div style="font-size:42px;font-weight:800;letter-spacing:0.25em;color:#f3b21a;font-family:'JetBrains Mono','Courier New',monospace">${String(pin)}</div>
                  <div style="font-size:11px;color:rgba(255,255,255,.35);margin-top:10px;letter-spacing:0.1em">Enter this 6-digit code on the vault lock screen</div>
                </div>
                <div style="background:#fff8e6;border:1px solid #f3b21a30;border-radius:12px;padding:14px 18px;font-size:12px;color:#7a6020;line-height:1.6;margin:20px 0">
                  ⚠ <strong>Keep this code private.</strong> This PIN grants access to sealed letters, legal documents, and estate records. Do not share it further unless authorised by ${senderName || 'the vault owner'}.
                </div>
                <p style="font-size:12px;color:#948a7a;margin-top:24px">If you did not expect this email, please contact ${senderName || 'the person'} who sent it, or reach us at <a href="mailto:vault@whowasi.uk" style="color:#d99206;">vault@whowasi.uk</a>.</p>`,
              footer: 'WHO WAS I · Living Memorial Platform · whowasi.uk<br/>This code was shared securely by a verified family member.',
            }),
          }),
        })
        if (!resp.ok) {
          const txt = await resp.text()
          console.error('[email/vault-share-pin] Resend error for', recipient.email, txt)
          errors.push(recipient.email)
        }
      } catch (err) {
        console.error('[email/vault-share-pin] Error for', recipient.email, err)
        errors.push(recipient.email)
      }
    }

    return { json: { ok: true, sent: recipients.length - errors.length, failed: errors } }
  },

  // ── Vault reset ─────────────────────────────────────────────────────────
  async 'vault-reset'(body) {
    const { email, code, memorialName } = body
    if (!email || !code || !/^\d{6}$/.test(String(code))) {
      return { status: 400, json: { error: 'Missing or invalid email/code' } }
    }

    // Verify email belongs to an actual account
    try {
      const q = await instantQuery({ $users: { $: { where: { email: String(email).toLowerCase() } } } })
      const exists = (q?.$users || []).length > 0
      if (!exists) return { json: { ok: true } }
    } catch { return { json: { ok: true } } }

    const safeName = (memorialName || 'your Legacy Vault').slice(0, 80)

    await resend.emails.send({
      from: 'WHO WAS I <admin@whowasi.uk>',
      to: String(email),
      subject: 'Your Legacy Vault PIN reset code',
      html: buildHtml({
        body: `
          <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:#FFD700;margin:0 0 8px">WHO WAS I · Legacy Vault</p>
          <h1 style="font-size:22px;margin:0 0 16px;color:#fff">Reset your vault PIN</h1>
          <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,.65);margin:0 0 24px">
            You asked to reset the PIN for <strong style="color:#fff">${safeName}</strong>. Enter this code in the app to set a new PIN:
          </p>
          <div style="background:rgba(255,215,0,.10);border:1px solid rgba(255,215,0,.25);border-radius:12px;padding:20px;text-align:center;margin:0 0 24px">
            <span style="font-size:34px;font-weight:800;letter-spacing:8px;color:#FFD700">${code}</span>
          </div>
          <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,.4);margin:0">
            This code expires in 15 minutes. If you didn't request this, you can safely ignore this email — your vault stays locked and unchanged.
          </p>`,
        footer: 'WHO WAS I · Legacy Vault · whowasi.uk',
      }),
    })
    return { json: { ok: true } }
  },

  // ── Family connection request ───────────────────────────────────────────
  // The memorial owner is notified at the email on their account ($users.email).
  // ownerUserId is the InstantDB user id — we look up the email first.
  async 'family-connection-request'(body) {
    const { token, claimerName, claimerEmail, relation, ownerUserId, memorialName } = body
    if (!token || !ownerUserId) return { status: 400, json: { error: 'Missing required fields' } }

    // Resolve the owner's email from their userId
    let ownerEmail = null
    try {
      const r = await instantQuery({ $users: { $: { where: { id: ownerUserId } } } })
      ownerEmail = r?.$users?.[0]?.email
    } catch {}
    if (!ownerEmail) {
      return { json: { skipped: true, reason: 'owner has no email on file' } }
    }

    const approveUrl = `${APP}/connect/family/verify/${token}?action=approve`
    const rejectUrl  = `${APP}/connect/family/verify/${token}?action=reject`
    const reviewUrl  = `${APP}/connect/family/verify/${token}`
    const subjectMem = memorialName ? ` (${memorialName})` : ''

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WHO WAS I <noreply@whowasi.uk>',
        to: [ownerEmail],
        subject: `${claimerName || 'Someone'} wants to join your family${subjectMem}`,
        html: buildHtml({
          body: `
            <h2>Family Connection Request</h2>
            <p><strong>${claimerName || 'Someone'}</strong> has requested to join your family circle${memorialName ? ` for <strong>${memorialName}</strong>` : ''} on WHO WAS I.</p>
            <p>They claim to be your: <span style="display:inline-block;background:#f3b21a;color:#15120e;font-weight:700;padding:4px 14px;border-radius:999px;font-size:13px;margin:4px 0">${relation || 'family member'}</span></p>
            ${claimerEmail ? `<p>Their email: <strong>${claimerEmail}</strong></p>` : ''}
            <p style="margin-top:24px">Please review and approve, decline, or suggest a different relationship:</p>
            <div style="margin:20px 0">
              <a href="${approveUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;background:#f3b21a;color:#15120e;margin-right:12px">✓ Approve</a>
              <a href="${reviewUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;background:#fff;color:#15120e;border:1px solid #e0d8c4;margin-right:12px">✎ Review</a>
              <a href="${rejectUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;background:#f0ece0;color:#6e6a62">✕ Decline</a>
            </div>`,
          footer: 'WHO WAS I · Living Memorial Platform · whowasi.uk<br/>If you did not expect this request, you can safely ignore this email.',
        }),
      }),
    })
    return { json: { ok: true } }
  },

  // ── Family connection approved ──────────────────────────────────────────
  async 'family-connection-approved'(body) {
    const { claimerEmail, claimerName, relation, ownerName } = body
    if (!claimerEmail) return { status: 400, json: { error: 'Missing claimerEmail' } }

    const treeUrl = `${APP}/family-tree`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WHO WAS I <noreply@whowasi.uk>',
        to: [claimerEmail],
        subject: `You've been added to the family circle on WHO WAS I`,
        html: buildHtml({
          body: `
            <h2>You've been welcomed to the family ✦</h2>
            <p>Hi <strong>${claimerName || 'there'}</strong>,</p>
            <p>Great news — <strong>${ownerName || 'the family'}</strong> has approved your connection request. You are now part of their family circle on WHO WAS I as:</p>
            <p><span style="display:inline-block;background:#f3b21a;color:#15120e;font-weight:700;padding:4px 14px;border-radius:999px;font-size:13px;margin:4px 0">${relation || 'Family member'}</span></p>
            <p style="margin-top:20px">As a connected family member you can now:</p>
            <ul style="font-size:14px;color:#4a4030;line-height:2;padding-left:20px">
              <li>Leave tributes and share photos on the memorial</li>
              <li>Send and receive private family messages</li>
              <li>View and download vault documents shared with family</li>
              <li>Help keep the memorial up to date</li>
            </ul>
            <a href="${treeUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;background:#f3b21a;color:#15120e;margin:16px 0">View your family tree →</a>`,
          footer: 'WHO WAS I · Living Memorial Platform · whowasi.uk<br/>This email was sent because a family connection was approved on your account.',
        }),
      }),
    })
    return { json: { ok: true } }
  },

  // ── Family connection — owner suggested a different relation ──────────
  // The inviter (claimer) sees the suggestion on their dashboard and gets
  // an email asking them to confirm or decline the new label.
  async 'family-connection-suggested'(body) {
    const { claimerEmail, claimerName, originalRelation, suggestedRelation, ownerName } = body
    if (!claimerEmail) return { status: 400, json: { error: 'Missing claimerEmail' } }

    const dashUrl = `${APP}/dashboard?tab=overview`

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WHO WAS I <noreply@whowasi.uk>',
        to: [claimerEmail],
        subject: `${ownerName || 'The family'} suggested a different relationship — please confirm`,
        html: buildHtml({
          body: `
            <h2>A small correction ✎</h2>
            <p>Hi <strong>${claimerName || 'there'}</strong>,</p>
            <p>You asked to join <strong>${ownerName || 'a family'}</strong>'s circle as <strong>${originalRelation || 'family'}</strong>. They've suggested a different relationship:</p>
            <p style="margin:20px 0">
              <span style="display:inline-block;background:#f3b21a;color:#15120e;font-weight:700;padding:6px 16px;border-radius:999px;font-size:14px">${suggestedRelation || 'family'}</span>
            </p>
            <p>Please open your dashboard to confirm this or decline. If you confirm, you'll be added to the family circle right away.</p>
            <a href="${dashUrl}" style="display:inline-block;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:700;text-decoration:none;background:#f3b21a;color:#15120e;margin:16px 0">Review on dashboard →</a>`,
          footer: 'WHO WAS I · Living Memorial Platform · whowasi.uk',
        }),
      }),
    })
    return { json: { ok: true } }
  },

  // ── Contact support (from the Profile → Contact support form) ─────────
  // Forwards a user's message to admin@whowasi.uk with their account context
  // so support can identify them without playing detective.
  async 'contact-support'(body) {
    const { fromEmail, fromName, subject, message, userId } = body
    if (!fromEmail || !message?.trim() || !subject?.trim()) {
      return { status: 400, json: { error: 'Missing fromEmail, subject, or message' } }
    }
    const safeSubject = String(subject).slice(0, 120).trim()
    const safeBody    = String(message).slice(0, 5000).trim()
    const safeName    = (fromName || '').slice(0, 80).trim() || 'Anonymous user'

    await resend.emails.send({
      from:     'WHO WAS I <admin@whowasi.uk>',
      to:       ['admin@whowasi.uk'],
      reply_to: fromEmail,
      subject:  `[Support] ${safeSubject}`,
      html: buildHtml({
        body: `
          <h2 style="color:#15120e;margin:0 0 16px">Support request</h2>
          <table style="width:100%;border-collapse:collapse;font-size:13px">
            <tr><td style="padding:6px 0;color:#7a7164;width:120px">From</td><td><strong>${safeName}</strong></td></tr>
            <tr><td style="padding:6px 0;color:#7a7164">Email</td><td><a href="mailto:${fromEmail}" style="color:#d99206">${fromEmail}</a></td></tr>
            ${userId ? `<tr><td style="padding:6px 0;color:#7a7164">User ID</td><td style="font-family:monospace;font-size:11px;color:#948a7a">${userId}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#7a7164">Subject</td><td>${safeSubject}</td></tr>
          </table>
          <div style="margin-top:20px;padding:16px;background:#f7f3ea;border-left:4px solid #f3b21a;border-radius:4px;white-space:pre-wrap;font-size:14px;line-height:1.6;color:#15120e">${safeBody}</div>
          <p style="margin-top:20px;font-size:12px;color:#7a7164">Reply directly to this email — it goes back to the user.</p>`,
        footer: 'WHO WAS I · Support inbox · whowasi.uk',
      }),
    })

    // Send the user a polite ack so they know the message landed
    await resend.emails.send({
      from:     'WHO WAS I <admin@whowasi.uk>',
      to:       [fromEmail],
      subject:  `We got your message — WHO WAS I`,
      html: buildHtml({
        body: `
          <h2 style="color:#15120e;margin:0 0 16px">Message received ✦</h2>
          <p style="font-size:14px;line-height:1.6;color:#4a4030;margin:0 0 16px">
            Hi <strong>${safeName}</strong>, thanks for reaching out. We've received your message and someone from the team will reply within 1-2 working days.
          </p>
          <div style="margin:20px 0;padding:16px;background:#f7f3ea;border-left:4px solid #f3b21a;border-radius:4px;white-space:pre-wrap;font-size:13px;line-height:1.6;color:#15120e">
            <p style="margin:0 0 8px;font-size:11px;letter-spacing:.18em;text-transform:uppercase;color:#948a7a">Your message · ${safeSubject}</p>
            ${safeBody}
          </div>
          <p style="font-size:12px;color:#7a7164;margin:20px 0 0">If your question is urgent (vault access, login issues, abuse reports), reply to this email and we'll see it sooner.</p>`,
        footer: 'WHO WAS I · whowasi.uk · You will hear from us soon.',
      }),
    })

    return { json: { ok: true } }
  },

  // ── Change email — Step 1: send a 6-digit code to the NEW email ───────
  // The code is stored as a SHA-256 hash on profile (never plaintext). The
  // user submits the code in Step 2 below to confirm they own the address.
  async 'change-email-send'(body) {
    const { userId, newEmail } = body
    if (!userId || !newEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(newEmail)) {
      return { status: 400, json: { error: 'Missing or invalid userId / newEmail' } }
    }
    const target = String(newEmail).toLowerCase().trim()

    // Make sure the target email isn't already in use by another account
    try {
      const r = await instantQuery({ $users: { $: { where: { email: target } } } })
      const existing = r?.$users?.[0]
      if (existing && existing.id !== userId) {
        return { status: 409, json: { error: 'That email is already linked to another account.' } }
      }
    } catch {}

    // 6-digit code, hashed before storage
    const { createHash } = await import('node:crypto')
    const code     = Math.floor(100000 + Math.random() * 900000).toString()
    const codeHash = createHash('sha256').update(code).digest('hex')
    const expires  = Date.now() + 15 * 60 * 1000

    // Save to profile via admin SDK
    const { init } = await import('@instantdb/admin')
    const adminDb  = init({
      appId:      process.env.VITE_INSTANT_APP_ID,
      adminToken: process.env.INSTANTDB_ADMIN_TOKEN,
    })
    const pq = await instantQuery({ profiles: { $: { where: { userId } } } })
    const profile = pq?.profiles?.[0]
    if (!profile) return { status: 404, json: { error: 'Profile not found' } }
    await adminDb.transact([
      adminDb.tx.profiles[profile.id].update({
        pendingEmail:         target,
        emailChangeCodeHash:  codeHash,
        emailChangeExpiresAt: expires,
      }),
    ])

    // Send the code to the NEW email (this is the address being verified)
    await resend.emails.send({
      from:    'WHO WAS I <admin@whowasi.uk>',
      to:      [target],
      subject: 'Confirm your new email — WHO WAS I',
      html: buildHtml({
        body: `
          <h2 style="color:#15120e;margin:0 0 12px">Confirm your new email</h2>
          <p style="font-size:14px;line-height:1.6;color:#4a4030;margin:0 0 20px">
            Someone (hopefully you) asked to change the email on their WHO WAS I account to this address.
            Enter this code in the app to confirm:
          </p>
          <div style="background:#fff8e6;border:1px solid #f3b21a40;border-radius:14px;padding:24px;text-align:center;margin:0 0 24px">
            <span style="font-family:'JetBrains Mono',monospace;font-size:38px;font-weight:800;letter-spacing:10px;color:#d99206">${code}</span>
          </div>
          <p style="font-size:12px;color:#7a7164;margin:0">
            This code expires in 15 minutes. If you didn't request this, ignore this email — nothing will change.
          </p>`,
        footer: 'WHO WAS I · whowasi.uk',
      }),
    })

    return { json: { ok: true } }
  },

  // ── Change email — Step 2: verify the code & swap $users.email ────────
  // Updates the canonical email on $users via admin so future logins,
  // verifications, and vault PIN resets all go to the new address.
  async 'change-email-verify'(body) {
    const { userId, code } = body
    if (!userId || !code || !/^\d{6}$/.test(String(code))) {
      return { status: 400, json: { error: 'Missing or invalid code' } }
    }

    const { createHash } = await import('node:crypto')
    const codeHash = createHash('sha256').update(String(code)).digest('hex')

    const pq = await instantQuery({ profiles: { $: { where: { userId } } } })
    const profile = pq?.profiles?.[0]
    if (!profile) return { status: 404, json: { error: 'Profile not found' } }

    if (!profile.pendingEmail || !profile.emailChangeCodeHash) {
      return { status: 400, json: { error: 'No pending email change for this account.' } }
    }
    if (profile.emailChangeExpiresAt && profile.emailChangeExpiresAt < Date.now()) {
      return { status: 400, json: { error: 'The code has expired. Please request a new one.' } }
    }
    if (profile.emailChangeCodeHash !== codeHash) {
      return { status: 400, json: { error: 'That code is incorrect. Check the email and try again.' } }
    }

    // Update $users.email via admin SDK, clear pending fields on profile
    const { init } = await import('@instantdb/admin')
    const adminDb  = init({
      appId:      process.env.VITE_INSTANT_APP_ID,
      adminToken: process.env.INSTANTDB_ADMIN_TOKEN,
    })

    await adminDb.transact([
      adminDb.tx.$users[userId].update({ email: profile.pendingEmail }),
      adminDb.tx.profiles[profile.id].update({
        pendingEmail:         null,
        emailChangeCodeHash:  null,
        emailChangeExpiresAt: null,
      }),
    ])

    return { json: { ok: true, newEmail: profile.pendingEmail } }
  },

  // ── Report tribute ──────────────────────────────────────────────────────
  async 'report-tribute'(body) {
    const { tributeId, tributeText, authorName, memorialName, reason, note } = body
    if (!reason) return { status: 400, json: { error: 'Missing reason' } }

    await resend.emails.send({
      from: 'WHO WAS I <admin@whowasi.uk>',
      to: ['admin@whowasi.uk'],
      subject: `[Report] Tribute on "${memorialName}" — ${reason}`,
      html: buildHtml({
        body: `
          <h2 style="color:#e53e3e">Tribute Reported</h2>
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#666;width:120px">Memorial</td><td style="font-weight:600">${memorialName}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Tribute ID</td><td style="font-family:monospace;font-size:12px">${tributeId}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Author</td><td>${authorName || 'Anonymous'}</td></tr>
            <tr><td style="padding:8px 0;color:#666">Reason</td><td style="color:#e53e3e;font-weight:600">${reason}</td></tr>
          </table>
          ${tributeText ? `<div style="margin:16px 0;padding:12px;background:#f5f5f5;border-left:4px solid #e53e3e;border-radius:4px"><p style="margin:0">${tributeText}</p></div>` : ''}
          ${note ? `<p><strong>Note:</strong> ${note}</p>` : ''}`,
        footer: 'WHO WAS I · whowasi.uk',
      }),
    })
    return { json: { ok: true } }
  },

  // ── Send anniversary (cron) ────────────────────────────────────────────
  async 'send-anniversary'(body, headers) {
    const auth = headers?.authorization
    if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
      return { status: 401, json: { error: 'Unauthorized' } }
    }

    const today = new Date()
    const mon   = today.getMonth() + 1
    const day   = today.getDate()

    let memorials = []
    try {
      const r = await instantQuery({ memorials: {}, profiles: {} })
      memorials = r?.memorials || []
    } catch { return { status: 500, json: { error: 'DB fetch failed' } } }

    const sent = [], errors = []

    for (const m of memorials) {
      const events = []
      if (m.dod) {
        const d = new Date(m.dod)
        const yrs = today.getFullYear() - d.getFullYear()
        if (d.getMonth() + 1 === mon && d.getDate() === day && yrs > 0) {
          events.push({ label: yrs === 1 ? 'One year ago today' : `${yrs} years ago today`, detail: `${m.name} passed away on this day.` })
        }
      }
      if (m.dob) {
        const d = new Date(m.dob)
        const age = today.getFullYear() - d.getFullYear()
        if (d.getMonth() + 1 === mon && d.getDate() === day) {
          events.push({ label: m.alive !== false ? 'Happy Birthday 🎂' : `Would have been ${age}`, detail: `${m.name}'s birthday is today.` })
        }
      }
      if (!events.length || !m.creatorId) continue

      let email = null
      try {
        const ur = await instantQuery({ $users: { $: { where: { id: m.creatorId } } } })
        email = ur?.$users?.[0]?.email
      } catch { continue }
      if (!email) continue

      const url = `${APP}/memorial/${m.id}`
      try {
        const { data } = await resend.emails.send({
          from: 'WHO WAS I <admin@whowasi.uk>',
          to: [email],
          subject: `${events[0].label} — ${m.name}`,
          html: buildHtml({
            body: `
              <p style="font-size:11px;letter-spacing:.22em;text-transform:uppercase;color:rgba(255,215,0,.65);margin:0 0 28px">WHO WAS I · whowasi.uk</p>
              <div style="background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.10);border-radius:20px;padding:28px;margin-bottom:20px">
                ${m.photo ? `<img src="${m.photo}" style="width:100%;height:200px;object-fit:cover;object-position:center top;border-radius:12px;display:block;margin-bottom:20px">` : ''}
                ${events.map(e => `<p style="font-size:11px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:rgba(255,215,0,.7);margin:0 0 6px">${e.label}</p>
                <p style="font-size:22px;font-weight:700;color:#fff;margin:0 0 8px;line-height:1.2">${m.name}</p>
                <p style="font-size:14px;color:rgba(255,255,255,.5);margin:0 0 16px">${e.detail}</p>`).join('')}
              </div>
              <div style="text-align:center;margin-bottom:28px">
                <a href="${url}" style="display:inline-block;background:linear-gradient(135deg,#FFD700,#38BDF8);color:#000;font-weight:700;font-size:14px;padding:14px 32px;border-radius:100px;text-decoration:none">✦ Visit their memorial</a>
              </div>`,
            footer: 'WHO WAS I · <a href="' + APP + '" style="color:rgba(255,215,0,.4);text-decoration:none">whowasi.uk</a>',
          }),
        })
        sent.push({ name: m.name, email, id: data?.id })
      } catch (e) {
        errors.push({ name: m.name, error: e.message })
      }
    }

    return { json: { sent: sent.length, errors: errors.length, details: sent } }
  },
}

// ── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  const { action, ...body } = req.body || {}
  if (!action || !actions[action]) {
    return res.status(400).json({ error: `Unknown action: ${action}. Valid: ${Object.keys(actions).join(', ')}` })
  }

  const RESEND_KEY = process.env.RESEND_API_KEY
  if (!RESEND_KEY && action !== 'send-anniversary') {
    console.warn(`[email/${action}] RESEND_API_KEY not set — email not sent`)
    return res.status(200).json({ ok: true, note: 'Email service not configured' })
  }

  try {
    const result = await actions[action](body, req.headers)
    const status = result?.status || 200
    return res.status(status).json(result?.json || result)
  } catch (err) {
    console.error(`[email/${action}] Error:`, err)
    return res.status(500).json({ error: err.message })
  }
}
