// src/components/orbital/FamilyTreeOrb.jsx — v2
// Immersive full-viewport orbital canvas.
//
// Visual design:
//   • position:fixed canvas — fills entire screen, rings extend off all edges
//   • DEPTH OF FIELD via ctx.filter: blur(Xpx) per ring
//       Ring 1 (Immediate)  → sharp,       opacity 1.00
//       Ring 2 (Parents)    → blur(0.8px), opacity 0.75
//       Ring 3 (Extended)   → blur(2.4px), opacity 0.48
//   • Clean dashed orbit circles, no tick marks (no digital/TV look)
//   • Connection lines only for inner ring — ultra-subtle
//   • Selection: soft radial glow, not border flash
//   • Node initials always rendered at full sharpness (drawn outside blur layer)
//   • First name label below inner ring nodes

import { useRef, useEffect, useCallback } from 'react'

const RING_R         = [0, 210, 382, 550]
const RING_ROT_SPD   = [0, 0.20, -0.10, 0.06]   // degrees per tick; neg = CCW
const NODE_R         = [0, 25, 20, 16]
const CENTER_R       = 46
const RING_BLUR      = [0, 0, 0.8, 2.4]          // ctx.filter blur px
const RING_ALPHA     = [0, 1.0, 0.75, 0.48]      // globalAlpha per ring
const RING_STROKE    = ['','rgba(74,170,74,.18)','rgba(78,205,196,.14)','rgba(200,160,30,.11)']

const imgCache = {}
function loadImg(url, key) {
  if (!url) return null
  if (!imgCache[key]) { const i = new Image(); i.src = url; imgCache[key] = i }
  return imgCache[key]
}

function nc(alive) {
  return alive
    ? { s:'#4aaa4a', t:'#90d890', g:'rgba(74,170,74,',  f:'rgba(8,22,8,0.97)'   }
    : { s:'#c8a020', t:'#d4b840', g:'rgba(200,160,30,', f:'rgba(20,14,2,0.97)'  }
}

function layoutMembers(members, centerId) {
  const rings = {1:[],2:[],3:[]}
  members.forEach(m => {
    if (m.id === centerId) return
    const r = Math.max(1, Math.min(3, m.ring ?? 1))
    rings[r].push(m)
  })
  const out = []
  ;[1,2,3].forEach(ri => {
    rings[ri].forEach((m, i) => {
      const a = m.angle != null ? m.angle : (360 / Math.max(rings[ri].length, 1)) * i + ri * 18
      out.push({ ...m, _ring: ri, _angle: a })
    })
  })
  return out
}

function nodePos(ring, angleDeg, rotTicks, CX, CY) {
  const rad = (angleDeg * Math.PI / 180) + (rotTicks * RING_ROT_SPD[ring] * Math.PI / 180)
  return { x: CX + RING_R[ring] * Math.cos(rad), y: CY + RING_R[ring] * Math.sin(rad) }
}

export default function FamilyTreeOrb({ members = [], onSelectMember, centerMemberId }) {
  const canvasRef  = useRef(null)
  const rotRef     = useRef(0)
  const rafRef     = useRef(null)
  const layoutRef  = useRef([])
  const centerRef  = useRef(null)
  const selRef     = useRef(null)
  const hovRef     = useRef(null)

  useEffect(() => {
    if (!members.length) {
      // No members — clear center so the canvas draws nothing in the middle;
      // the JSX overlay in FamilyTreePage shows the user's name instead.
      centerRef.current = null
      layoutRef.current = []
      return
    }
    // When a member is explicitly selected as center, use it; otherwise null so
    // the JSX label (user's own name) shows as the center, not a random member.
    centerRef.current = centerMemberId
      ? (members.find(m => m.id === centerMemberId) ?? null)
      : null
    layoutRef.current = layoutMembers(members, centerRef.current?.id)
  }, [members, centerMemberId])

  useEffect(() => {
    // Always sync selection ref — clear it when centerMemberId goes back to null
    selRef.current = centerMemberId || null
  }, [centerMemberId])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function frame() {
      rotRef.current += 0.05
      const rot = rotRef.current
      const W   = canvas.width  = window.innerWidth
      const H   = canvas.height = window.innerHeight
      const CX  = W / 2, CY = H / 2
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      const layout = layoutRef.current
      const center = centerRef.current
      const selId  = selRef.current
      const hovId  = hovRef.current

      // ── Stars ──────────────────────────────────────────────────────────────
      for (let i = 0; i < 100; i++) {
        ctx.beginPath()
        ctx.arc(
          (Math.sin(i * 137.5 + 1) * 0.5 + 0.5) * W,
          (Math.cos(i * 97.3  + 2) * 0.5 + 0.5) * H,
          0.4 + (i % 3) * 0.22, 0, Math.PI * 2
        )
        ctx.fillStyle = `rgba(255,255,255,${0.004 + (i % 7) * 0.002})`
        ctx.fill()
      }

      // ── Orbital ring circles ───────────────────────────────────────────────
      ;[3, 2, 1].forEach(ri => {
        ctx.save()
        ctx.globalAlpha = RING_ALPHA[ri]
        ctx.beginPath(); ctx.arc(CX, CY, RING_R[ri], 0, Math.PI * 2)
        ctx.strokeStyle = RING_STROKE[ri]; ctx.lineWidth = 0.7
        ctx.setLineDash([3, 14]); ctx.stroke(); ctx.setLineDash([])
        ctx.restore()
      })

      // ── Connection lines (ring 1 only) ─────────────────────────────────────
      layout.filter(m => m._ring === 1).forEach(m => {
        const p = nodePos(m._ring, m._angle, rot, CX, CY)
        const c = nc(m.alive)
        ctx.beginPath(); ctx.moveTo(CX, CY)
        ctx.quadraticCurveTo((CX + p.x) / 2, (CY + p.y) / 2, p.x, p.y)
        ctx.strokeStyle = `${c.g}0.11)`; ctx.lineWidth = 0.55; ctx.stroke()
      })

      // ── Nodes per ring — outermost first so inner renders on top ───────────
      ;[3, 2, 1].forEach(ri => {
        const rMembers = layout.filter(m => m._ring === ri)
        if (!rMembers.length) return

        rMembers.forEach(m => {
          const p   = nodePos(m._ring, m._angle, rot, CX, CY)
          const R   = NODE_R[m._ring]
          const c   = nc(m.alive)
          const sel = selId === m.id
          const hov = hovId === m.id && !sel

          // Hover ring — drawn sharp
          if (hov) {
            ctx.beginPath(); ctx.arc(p.x, p.y, R + 7, 0, Math.PI * 2)
            ctx.strokeStyle = `${c.g}0.28)`; ctx.lineWidth = 1; ctx.stroke()
          }

          // Selection glow — drawn sharp, before blur layer
          if (sel) {
            const grd = ctx.createRadialGradient(p.x, p.y, R, p.x, p.y, R + 28)
            grd.addColorStop(0, `${c.g}0.42)`)
            grd.addColorStop(1, `${c.g}0.00)`)
            ctx.beginPath(); ctx.arc(p.x, p.y, R + 28, 0, Math.PI * 2)
            ctx.fillStyle = grd; ctx.fill()
            ctx.beginPath(); ctx.arc(p.x, p.y, R + 5, 0, Math.PI * 2)
            ctx.strokeStyle = `${c.g}0.72)`; ctx.lineWidth = 1.2; ctx.stroke()
          }

          // ── Node with depth-of-field blur ───────────────────────────────
          ctx.save()
          ctx.globalAlpha = RING_ALPHA[ri]
          if (RING_BLUR[ri] > 0) ctx.filter = `blur(${RING_BLUR[ri]}px)`

          // Photo or fill
          const img = m.photo ? loadImg(m.photo, m.id) : null
          if (img?.complete && img.naturalWidth > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
            ctx.clip(); ctx.drawImage(img, p.x - R, p.y - R, R * 2, R * 2); ctx.restore()
          } else {
            ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
            ctx.fillStyle = c.f; ctx.fill()
          }

          // Border
          ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
          ctx.strokeStyle = sel ? 'rgba(255,255,255,0.80)' : c.s
          ctx.lineWidth   = sel ? 1.6 : 0.8; ctx.stroke()

          ctx.restore() // end blur layer

          // ── Status dot — always sharp ─────────────────────────────────
          const da = Math.PI * 0.22
          ctx.beginPath()
          ctx.arc(p.x + R * Math.cos(da), p.y + R * Math.sin(da), 3, 0, Math.PI * 2)
          ctx.fillStyle = c.s; ctx.fill()

          // ── Initials — always rendered sharp ──────────────────────────
          ctx.save()
          ctx.globalAlpha = RING_ALPHA[ri]
          ctx.font = `600 ${Math.round(R * 0.48)}px 'Inter',-apple-system,sans-serif`
          ctx.fillStyle = sel ? 'rgba(255,255,255,0.92)' : c.t
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText((m.avatar || m.name?.slice(0, 2) || '?').toUpperCase(), p.x, p.y)
          ctx.restore()

          // ── First name label (ring 1 only) ─────────────────────────────
          if (m._ring === 1) {
            ctx.save()
            ctx.globalAlpha = sel ? 0.70 : 0.30
            ctx.font = `400 9px 'Inter',-apple-system,sans-serif`
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
            ctx.fillText(m.name?.split(' ')[0] || '', p.x, p.y + R + 6)
            ctx.restore()
          }
        })
      })

      // ── Center node ────────────────────────────────────────────────────────
      if (center) {
        const c  = nc(center.alive)
        const t  = Date.now() / 1000

        // Ambient glow
        const ag = ctx.createRadialGradient(CX, CY, CENTER_R * 0.3, CX, CY, CENTER_R + 44)
        ag.addColorStop(0, `${c.g}0.15)`)
        ag.addColorStop(1, `${c.g}0.00)`)
        ctx.beginPath(); ctx.arc(CX, CY, CENTER_R + 44, 0, Math.PI * 2)
        ctx.fillStyle = ag; ctx.fill()

        // Breathing rings
        ;[CENTER_R + 13, CENTER_R + 6].forEach((r, i) => {
          const pulse = 0.5 + 0.5 * Math.sin(t * (i === 0 ? 0.9 : 1.2) + i * 0.7)
          ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2)
          ctx.strokeStyle = `${c.g}${i === 0 ? 0.12 + pulse * 0.08 : 0.28 + pulse * 0.18})`
          ctx.lineWidth   = i === 0 ? 1 : 1.3; ctx.stroke()
        })

        // Background
        const img = center.photo ? loadImg(center.photo, center.id + '_c') : null
        if (img?.complete && img.naturalWidth > 0) {
          ctx.save(); ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
          ctx.clip(); ctx.drawImage(img, CX - CENTER_R, CY - CENTER_R, CENTER_R * 2, CENTER_R * 2)
          ctx.restore()
        } else {
          ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
          ctx.fillStyle = 'rgba(10,7,1,0.97)'; ctx.fill()
          const ig = ctx.createRadialGradient(CX - 10, CY - 10, 0, CX, CY, CENTER_R)
          ig.addColorStop(0, `${c.g}0.18)`)
          ig.addColorStop(1, `${c.g}0.02)`)
          ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
          ctx.fillStyle = ig; ctx.fill()
        }

        // Border
        ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
        ctx.strokeStyle = `${c.g}0.55)`; ctx.lineWidth = 1.4; ctx.stroke()

        // Initials
        ctx.font = `700 18px 'Cormorant Garamond',Georgia,serif`
        ctx.fillStyle = `${c.g}0.82)`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
        ctx.fillText((center.avatar || center.name?.slice(0, 2) || 'ME').toUpperCase(), CX, CY)
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    rafRef.current = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  // ── Input ──────────────────────────────────────────────────────────────────

  const hitTest = useCallback((cx, cy) => {
    const canvas = canvasRef.current; if (!canvas) return null
    const CX = canvas.width / 2, CY = canvas.height / 2, rot = rotRef.current
    if (Math.hypot(cx - CX, cy - CY) <= CENTER_R + 8) return { _center: true, member: centerRef.current }
    for (const ri of [1, 2, 3]) {
      for (const m of layoutRef.current.filter(d => d._ring === ri)) {
        const p = nodePos(m._ring, m._angle, rot, CX, CY)
        if (Math.hypot(cx - p.x, cy - p.y) <= NODE_R[m._ring] + 12) return m
      }
    }
    return null
  }, [])

  const handleClick = useCallback(e => {
    const h = hitTest(e.clientX, e.clientY)
    if (!h) { selRef.current = null; onSelectMember?.(null); return }
    if (h._center) { onSelectMember?.(h.member); return }
    const found = members.find(m => m.id === h.id)
    if (found) { selRef.current = found.id; onSelectMember?.(found) }
  }, [members, hitTest, onSelectMember])

  const handleMove = useCallback(e => {
    const h = hitTest(e.clientX, e.clientY)
    hovRef.current = h && !h._center ? h.id : null
    canvasRef.current.style.cursor = h ? 'pointer' : 'default'
  }, [hitTest])

  const handleTouchEnd = useCallback(e => {
    e.preventDefault()
    const t = e.changedTouches[0]
    if (t) handleClick({ clientX: t.clientX, clientY: t.clientY })
  }, [handleClick])

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onMouseMove={handleMove}
      onTouchEnd={handleTouchEnd}
      style={{ position:'fixed', top:0, left:0, width:'100%', height:'100%', display:'block', touchAction:'none' }}
    />
  )
}
