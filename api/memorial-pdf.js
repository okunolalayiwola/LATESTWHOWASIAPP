// api/memorial-pdf.js
// GET /api/memorial-pdf?id=<memorialId>
//   → streams a designed keepsake-booklet PDF of the memorial.
//
// Vercel serverless (Node). Uses pdfkit (pure JS, no native deps).
//
// Env: INSTANTDB_ADMIN_TOKEN, NEXT_PUBLIC_APP_URL
//
// Composition:
//   1. Cover         — banner tint, portrait, name, years, relation
//   2. Life Story    — bio in elegant serif body
//   3. Gallery       — up to 6 photos, 2-up grid, captions
//   4. Tributes      — messages people left, styled cards
//   5. Closing       — WHO WAS I mark + memorial URL + QR-less footer

import PDFDocument from 'pdfkit'

const DB  = 'https://api.instantdb.com/admin'
const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://whowasi.uk'

// ── Palette (matches the app) ────────────────────────────────────────────────
const C = {
  bg:     '#0d0d12',
  gold:   '#FFD700',
  sky:    '#38BDF8',
  lav:    '#C084FC',
  cream:  '#EDE7D9',
  dim:    '#8A8578',
  white:  '#FFFFFF',
  line:   '#2A2A33',
}

async function fetchJSON(url, opts) {
  const r = await fetch(url, opts)
  if (!r.ok) throw new Error(`Fetch ${r.status}`)
  return r.json()
}

// Pull an image URL into a Buffer so pdfkit can embed it.
async function imgBuffer(url) {
  if (!url) return null
  try {
    // Cloudinary: request a sane size/quality so the function stays light
    let u = url
    if (u.includes('cloudinary.com') && u.includes('/upload/')) {
      u = u.replace('/upload/', '/upload/w_1000,q_auto,f_jpg/')
      u = u.replace(/\.(webp|png|heic)$/i, '.jpg')
    }
    const r = await fetch(u)
    if (!r.ok) return null
    const ab = await r.arrayBuffer()
    return Buffer.from(ab)
  } catch {
    return null
  }
}

export default async function handler(req, res) {
  const { id } = req.query
  if (!id) { res.status(400).send('Missing memorial id'); return }

  // ── 1. Fetch the memorial + photos + tributes via admin API ───────────────
  let memorial
  try {
    const data = await fetchJSON(`${DB}/query`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
      body: JSON.stringify({
        query: { memorials: { $: { where: { id } }, photos: {}, tributes: {} } },
      }),
    })
    memorial = data?.memorials?.[0]
  } catch (e) {
    res.status(500).send('Could not load memorial'); return
  }
  if (!memorial) { res.status(404).send('Memorial not found'); return }

  const photos   = (memorial.photos   || []).slice(0, 6)
  const tributes = (memorial.tributes || [])
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
    .slice(0, 12)

  // ── 2. Pre-fetch images (parallel) ────────────────────────────────────────
  const [portrait, banner, ...galleryBufs] = await Promise.all([
    imgBuffer(memorial.photo),
    imgBuffer(memorial.coverPhoto),
    ...photos.map(p => imgBuffer(p.url)),
  ])

  // ── 3. Build the PDF ──────────────────────────────────────────────────────
  const doc = new PDFDocument({
    size: 'A4',
    margins: { top: 60, bottom: 60, left: 56, right: 56 },
    info: {
      Title:   `${memorial.name} — A WHO WAS I Keepsake`,
      Author:  'WHO WAS I',
      Subject: `In remembrance of ${memorial.name}`,
    },
  })

  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader(
    'Content-Disposition',
    `inline; filename="${(memorial.name || 'memorial').replace(/[^a-z0-9]/gi, '-')}-keepsake.pdf"`
  )
  doc.pipe(res)

  const W  = doc.page.width
  const H  = doc.page.height
  const ML = doc.page.margins.left
  const MR = W - doc.page.margins.right
  const CW = MR - ML

  const paintBg = () => doc.save().rect(0, 0, W, H).fill(C.bg).restore()

  // Footer mark on every page
  const footer = () => {
    doc.save()
      .fontSize(7).fillColor(C.dim).font('Helvetica')
      .text('WHO WAS I  ·  whowasi.uk', ML, H - 42, { width: CW, align: 'center', characterSpacing: 2 })
      .restore()
  }

  // ===== PAGE 1 — COVER =======================================================
  paintBg()

  // Soft gradient band at top
  doc.save()
  const grad = doc.linearGradient(0, 0, W, 220)
  grad.stop(0, C.gold).stop(0.5, C.lav).stop(1, C.sky)
  doc.rect(0, 0, W, 6).fill(grad)
  doc.restore()

  // Banner image (subtle, behind)
  if (banner) {
    doc.save()
    try { doc.image(banner, 0, 60, { width: W, height: 240, align: 'center' }) } catch {}
    doc.rect(0, 60, W, 240).fillOpacity(0.55).fill(C.bg).fillOpacity(1)
    doc.restore()
  }

  // Portrait — circular framed
  const pr = 78
  const pcx = W / 2
  const pcy = banner ? 230 : 210
  doc.save()
  doc.circle(pcx, pcy, pr + 4).lineWidth(2).stroke(C.gold)
  if (portrait) {
    doc.circle(pcx, pcy, pr).clip()
    try { doc.image(portrait, pcx - pr, pcy - pr, { width: pr * 2, height: pr * 2, align: 'center', valign: 'center' }) } catch {}
  } else {
    doc.circle(pcx, pcy, pr).fill('#1a1a22')
    doc.fillColor(C.gold).fontSize(48).font('Times-Bold')
      .text((memorial.name || '?').charAt(0), pcx - pr, pcy - 28, { width: pr * 2, align: 'center' })
  }
  doc.restore()

  // Name
  let y = pcy + pr + 40
  doc.fillColor(C.white).font('Times-Bold').fontSize(34)
    .text(memorial.name || 'In Memory', ML, y, { width: CW, align: 'center' })

  y = doc.y + 6
  if (memorial.relation) {
    doc.fillColor(C.gold).font('Helvetica').fontSize(10)
      .text(memorial.relation.toUpperCase(), ML, y, { width: CW, align: 'center', characterSpacing: 3 })
    y = doc.y + 8
  }
  if (memorial.years || memorial.born) {
    doc.fillColor(C.dim).font('Times-Italic').fontSize(13)
      .text(memorial.years || `${memorial.born || ''} ${memorial.died ? '— ' + memorial.died : ''}`.trim(),
            ML, y, { width: CW, align: 'center' })
    y = doc.y
  }
  if (memorial.location) {
    doc.fillColor(C.dim).font('Helvetica').fontSize(9)
      .text(memorial.location, ML, doc.y + 6, { width: CW, align: 'center', characterSpacing: 1 })
  }

  // Divider flourish
  doc.save().moveTo(pcx - 40, H - 130).lineTo(pcx + 40, H - 130).lineWidth(0.5).stroke(C.line).restore()
  doc.fillColor(C.dim).font('Times-Italic').fontSize(10)
    .text('A life remembered', ML, H - 120, { width: CW, align: 'center' })
  footer()

  // ===== PAGE 2 — LIFE STORY ==================================================
  const bio = memorial.bio || memorial.description || memorial.subtitle
  if (bio) {
    doc.addPage(); paintBg()
    doc.fillColor(C.gold).font('Helvetica').fontSize(10)
      .text('THEIR STORY', ML, 70, { characterSpacing: 4 })
    doc.moveTo(ML, 92).lineTo(ML + 50, 92).lineWidth(2).stroke(C.gold)

    doc.fillColor(C.cream).font('Times-Roman').fontSize(13)
      .text(bio, ML, 116, { width: CW, align: 'left', lineGap: 8, paragraphGap: 10 })
    footer()
  }

  // ===== PAGE 3 — GALLERY =====================================================
  const validGallery = photos
    .map((p, i) => ({ p, buf: galleryBufs[i] }))
    .filter(x => x.buf)

  if (validGallery.length) {
    doc.addPage(); paintBg()
    doc.fillColor(C.sky).font('Helvetica').fontSize(10)
      .text('IN PHOTOGRAPHS', ML, 70, { characterSpacing: 4 })
    doc.moveTo(ML, 92).lineTo(ML + 50, 92).lineWidth(2).stroke(C.sky)

    const colW = (CW - 20) / 2
    const imgH = 150
    let gx = ML, gy = 116, col = 0

    for (const { p, buf } of validGallery) {
      doc.save()
      doc.roundedRect(gx, gy, colW, imgH, 8).clip()
      try { doc.image(buf, gx, gy, { width: colW, height: imgH, align: 'center', valign: 'center' }) } catch {}
      doc.restore()
      doc.roundedRect(gx, gy, colW, imgH, 8).lineWidth(0.5).stroke(C.line)

      if (p.caption || p.displayDate) {
        doc.fillColor(C.dim).font('Times-Italic').fontSize(8)
          .text(p.caption || p.displayDate, gx, gy + imgH + 5, { width: colW, align: 'center' })
      }

      col++
      if (col === 2) { col = 0; gx = ML; gy += imgH + 34 }
      else { gx += colW + 20 }

      if (gy + imgH > H - 80) {
        footer(); doc.addPage(); paintBg()
        gx = ML; gy = 70; col = 0
      }
    }
    footer()
  }

  // ===== PAGE 4 — TRIBUTES ====================================================
  if (tributes.length) {
    doc.addPage(); paintBg()
    doc.fillColor(C.lav).font('Helvetica').fontSize(10)
      .text('WORDS LEFT BEHIND', ML, 70, { characterSpacing: 4 })
    doc.moveTo(ML, 92).lineTo(ML + 50, 92).lineWidth(2).stroke(C.lav)

    let ty = 116
    for (const t of tributes) {
      const msg = t.content || t.text || ''
      if (!msg.trim()) continue
      const who  = t.authorName || t.author || 'Anonymous'
      const glyph = t.type === 'candle' ? '✦' : t.type === 'memory' ? '◎' : '♡'

      // Measure block height
      const msgH = doc.font('Times-Italic').fontSize(11).heightOfString(`"${msg}"`, { width: CW - 40, lineGap: 4 })
      const blockH = msgH + 44

      if (ty + blockH > H - 80) { footer(); doc.addPage(); paintBg(); ty = 70 }

      doc.save()
      doc.roundedRect(ML, ty, CW, blockH, 10).fillOpacity(0.04).fill(C.white).fillOpacity(1)
      doc.roundedRect(ML, ty, CW, blockH, 10).lineWidth(0.5).stroke(C.line)
      doc.restore()

      doc.fillColor(C.gold).fontSize(13).font('Times-Roman')
        .text(glyph, ML + 16, ty + 14)
      doc.fillColor(C.cream).font('Times-Italic').fontSize(11)
        .text(`"${msg}"`, ML + 40, ty + 14, { width: CW - 56, lineGap: 4 })
      doc.fillColor(C.dim).font('Helvetica').fontSize(8)
        .text(`— ${who}`, ML + 40, ty + blockH - 20, { width: CW - 56, characterSpacing: 1 })

      ty += blockH + 14
    }
    footer()
  }

  // ===== CLOSING PAGE =========================================================
  doc.addPage(); paintBg()
  const cy = H / 2 - 60
  doc.save()
  const g2 = doc.linearGradient(ML, cy, MR, cy)
  g2.stop(0, C.gold).stop(0.5, C.lav).stop(1, C.sky)
  doc.fontSize(22).font('Times-Bold').fillColor(C.gold)
    .text('WHO WAS I', ML, cy, { width: CW, align: 'center', characterSpacing: 3 })
  doc.restore()

  doc.fillColor(C.dim).font('Times-Italic').fontSize(11)
    .text('Every life is a story worth keeping.', ML, cy + 38, { width: CW, align: 'center' })

  doc.fillColor(C.cream).font('Helvetica').fontSize(9)
    .text(`View ${memorial.name}'s living memorial at`, ML, cy + 90, { width: CW, align: 'center' })
  doc.fillColor(C.sky).font('Helvetica-Bold').fontSize(10)
    .text(`${APP}/memorial/${id}`, ML, cy + 106, { width: CW, align: 'center' })

  footer()

  doc.end()
}
