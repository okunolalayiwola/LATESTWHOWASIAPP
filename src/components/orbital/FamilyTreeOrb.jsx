// src/components/orbital/FamilyTreeOrb.jsx — v3 "Infinite Web"
//
// What's new vs v2:
//   ✦ Explicit center object — parent passes who's in the middle (memorial OR
//     a connection person), not a string id
//   ✦ Click any orbiter → parent re-centers; the previous center becomes an
//     orbiter automatically (no node disappears)
//   ✦ Pan support — mouse drag + single-touch drag move the entire web. The
//     "infinite canvas" feel: the rings extend off the screen, the user
//     drags around them.
//   ✦ Per-node relation labels — small text under each ring-1 node so the
//     relation to the current center is always legible
//   ✦ Smooth re-center animation (lerp on pan recenter)
//
// Props:
//   center           — { id, name, photo, alive, isMemorial?, subtitle? }
//   members          — array of { id, name, photo, relation, alive, ring? }
//   onSelectMember   — (member) => void  — called when a member is clicked
//   onCenterClick    — () => void        — called when the center is clicked
//   onPanChange      — ({x, y}) => void  — optional pan reporter
//
// The parent decides what to do on click. Typically:
//   • Click an orbiter → parent updates `center` to that person.
//   • Click the center → parent may open a detail panel.

import { useRef, useEffect, useCallback, useState } from 'react'

const RING_R       = [0, 220, 392, 560]
const RING_ROT_SPD = [0, 0.18, -0.09, 0.05]   // deg/tick — slow drift
const NODE_R       = [0, 28, 22, 17]
const CENTER_R     = 52
const RING_BLUR    = [0, 0, 0.7, 2.2]
const RING_ALPHA   = [0, 1.00, 0.78, 0.50]
const RING_STROKE  = ['','rgba(74,170,74,.20)','rgba(78,205,196,.14)','rgba(200,160,30,.11)']

// The orbital plane is viewed at an angle → a tilted 3D disc. The y-axis is
// squashed so the rings read as ellipses receding into depth; nodes at the
// front (bottom) sit closer (bigger, sharper) than those at the back (top).
const TILT_Y = 0.66

// Low-detail continent outlines [lat, lng] for the geo-map backdrop. Rough on
// purpose — they're drawn soft + blurred so they read as glowing landmasses
// (a recognisable Earth) without needing a precise dataset.
const CONTINENTS = [
  // North America
  [[71,-156],[69,-141],[60,-141],[55,-131],[48,-124],[40,-124],[33,-117],[23,-110],[18,-95],[18,-88],[21,-87],[26,-80],[30,-81],[35,-76],[41,-70],[47,-60],[52,-56],[60,-64],[66,-62],[68,-78],[69,-95],[71,-125]],
  // Greenland
  [[83,-30],[81,-20],[76,-20],[70,-22],[60,-44],[66,-53],[76,-58],[81,-45]],
  // South America
  [[12,-72],[11,-62],[5,-52],[-2,-44],[-8,-35],[-13,-38],[-23,-41],[-34,-54],[-41,-63],[-52,-69],[-55,-67],[-50,-74],[-38,-73],[-30,-71],[-18,-70],[-6,-81],[1,-80],[8,-77]],
  // Africa
  [[35,-6],[37,10],[33,22],[31,32],[15,40],[11,51],[2,46],[-5,40],[-17,38],[-26,33],[-34,26],[-35,20],[-29,16],[-18,12],[-6,9],[4,6],[5,-4],[10,-15],[15,-17],[21,-17],[30,-10]],
  // Europe
  [[71,25],[66,42],[60,30],[56,21],[54,10],[58,5],[63,5]],
  [[60,-5],[50,-6],[43,-9],[36,-6],[37,3],[44,4],[50,2],[55,8],[60,12]],
  // Asia (Eurasia main)
  [[77,68],[75,100],[73,140],[68,178],[60,170],[52,142],[43,132],[38,122],[30,122],[22,110],[10,105],[8,98],[15,95],[20,88],[22,70],[25,62],[30,48],[40,50],[45,55],[55,60],[66,65]],
  // India peninsula
  [[28,70],[24,68],[18,73],[8,77],[13,80],[20,87],[26,90],[28,80]],
  // Australia
  [[-12,131],[-11,142],[-18,146],[-25,153],[-34,151],[-38,146],[-35,138],[-32,131],[-34,123],[-31,115],[-22,114],[-15,124]],
  // Indonesia hint
  [[5,95],[0,100],[-6,106],[-8,114],[-8,120],[-2,118],[2,109],[6,100]],
]

const imgCache = {}
const imgLoadCbs = new Set()

function loadImg(url, key) {
  if (!url) return null
  if (!imgCache[key]) {
    const i = new Image()
    i.crossOrigin = 'anonymous'
    i.onload = () => imgLoadCbs.forEach(cb => cb())
    i.src = url
    imgCache[key] = i
  }
  return imgCache[key]
}

function nc(alive) {
  return alive !== false
    ? { s:'#4aaa4a', t:'#90d890', g:'rgba(74,170,74,',  f:'rgba(8,22,8,0.97)'   }
    : { s:'#c8a020', t:'#d4b840', g:'rgba(200,160,30,', f:'rgba(20,14,2,0.97)'  }
}

// Distribute members onto rings; the center is excluded.
function layoutMembers(members, centerId) {
  const rings = { 1: [], 2: [], 3: [] }
  members.forEach(m => {
    if (m.id === centerId) return
    const r = Math.max(1, Math.min(3, m.ring ?? 1))
    rings[r].push(m)
  })
  const out = []
  ;[1, 2, 3].forEach(ri => {
    rings[ri].forEach((m, i) => {
      const a = m.angle != null ? m.angle : (360 / Math.max(rings[ri].length, 1)) * i + ri * 18
      out.push({ ...m, _ring: ri, _angle: a })
    })
  })
  return out
}

function nodePos(ring, angleDeg, rotTicks, CX, CY) {
  const rad = (angleDeg * Math.PI / 180) + (rotTicks * RING_ROT_SPD[ring] * Math.PI / 180)
  const s = Math.sin(rad)
  return {
    x: CX + RING_R[ring] * Math.cos(rad),
    y: CY + RING_R[ring] * s * TILT_Y,
    depth: s,   // -1 = back (top, farther) … +1 = front (bottom, nearer)
  }
}

// Truncate to fit
function fit(ctx, text, maxW) {
  if (!text) return ''
  const m = ctx.measureText(text)
  if (m.width <= maxW) return text
  let lo = 0, hi = text.length
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2)
    if (ctx.measureText(text.slice(0, mid) + '…').width <= maxW) lo = mid + 1
    else hi = mid
  }
  return text.slice(0, Math.max(1, lo - 1)) + '…'
}

export default function FamilyTreeOrb({
  center           = null,
  members          = [],
  geoLocations     = [],     // [{ id, name, lat, lng, alive }] — members with a home
  centerGeo        = null,   // { lat, lng } of the focal person — anchors the map
  onSelectMember,
  onCenterClick,
  onPanChange,
  panResetSignal   = 0,   // increment to recentre programmatically
}) {
  const canvasRef = useRef(null)
  const rotRef    = useRef(0)
  const rafRef    = useRef(null)
  const layoutRef = useRef([])
  const centerRef = useRef(null)
  const geoRef    = useRef({ center: null, locations: [] })
  const hovRef    = useRef(null)
  const panRef    = useRef({ x: 0, y: 0 })
  const dragRef   = useRef(null)   // { startX, startY, startPanX, startPanY }
  const movedRef  = useRef(false)

  const [panBadge, setPanBadge] = useState(false)

  // Keep the geo backdrop data fresh for the render loop
  useEffect(() => {
    geoRef.current = { center: centerGeo, locations: geoLocations }
  }, [centerGeo, geoLocations])

  // Update center + layout when props change
  useEffect(() => {
    centerRef.current = center
    layoutRef.current = layoutMembers(members, center?.id)
  }, [center, members])

  // Smooth re-pan to origin when parent bumps the reset signal
  useEffect(() => {
    if (panResetSignal === 0) return
    const start = { x: panRef.current.x, y: panRef.current.y }
    const t0 = performance.now()
    const dur = 420
    function step(t) {
      const k = Math.min(1, (t - t0) / dur)
      const ease = 1 - Math.pow(1 - k, 3)
      panRef.current = { x: start.x * (1 - ease), y: start.y * (1 - ease) }
      if (k < 1) requestAnimationFrame(step)
      else { panRef.current = { x: 0, y: 0 }; onPanChange?.(panRef.current) }
    }
    requestAnimationFrame(step)
  }, [panResetSignal])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    function frame() {
      rotRef.current += 0.05
      const rot = rotRef.current
      const W   = canvas.width  = window.innerWidth
      const H   = canvas.height = window.innerHeight
      const CX  = W / 2 + panRef.current.x
      const CY  = H / 2 + panRef.current.y
      const ctx = canvas.getContext('2d')
      ctx.clearRect(0, 0, W, H)

      const layout = layoutRef.current
      const centerObj = centerRef.current
      const hovId  = hovRef.current

      // ── Stars — parallax depth layer (drifts slower than the web on pan) ────
      const px = panRef.current.x * 0.12, py = panRef.current.y * 0.12
      for (let i = 0; i < 110; i++) {
        const sx = ((((Math.sin(i * 137.5 + 1) * 0.5 + 0.5) * W) + px) % W + W) % W
        const sy = ((((Math.cos(i * 97.3  + 2) * 0.5 + 0.5) * H) + py) % H + H) % H
        ctx.beginPath()
        ctx.arc(sx, sy, 0.4 + (i % 3) * 0.22, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${0.004 + (i % 7) * 0.002})`
        ctx.fill()
      }

      // ── Geo backdrop — a dreamy world map under the web; each member's home
      //    is a soft glow, tethered to their orbital node. Centred on the focal
      //    person's location, so panning the web pans the map with it. ────────
      {
        const geo = geoRef.current
        const cLat = geo.center?.lat ?? 25
        const cLng = geo.center?.lng ?? 10
        const PXY  = 6.6   // px per degree
        const projGeo = (lat, lng) => ({ x: CX + (lng - cLng) * PXY, y: CY - (lat - cLat) * PXY })

        // Bright oceanic world glow — clearly reads as "the world" behind the web
        const wg = ctx.createRadialGradient(CX, CY, 60, CX, CY, 900)
        wg.addColorStop(0,   'rgba(52,120,180,0.34)')
        wg.addColorStop(0.5, 'rgba(44,102,160,0.18)')
        wg.addColorStop(1,   'rgba(40,95,150,0)')
        ctx.beginPath(); ctx.arc(CX, CY, 900, 0, Math.PI * 2); ctx.fillStyle = wg; ctx.fill()

        // Continent silhouettes — soft glowing landmasses so it reads as Earth
        ctx.save()
        ctx.fillStyle = 'rgba(120,180,140,0.16)'
        ctx.filter = 'blur(6px)'
        CONTINENTS.forEach(poly => {
          ctx.beginPath()
          poly.forEach(([lat, lng], k) => { const p = projGeo(lat, lng); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y) })
          ctx.closePath(); ctx.fill()
        })
        ctx.filter = 'none'
        // crisp soft coastline glow on top
        ctx.strokeStyle = 'rgba(150,215,180,0.30)'; ctx.lineWidth = 1
        CONTINENTS.forEach(poly => {
          ctx.beginPath()
          poly.forEach(([lat, lng], k) => { const p = projGeo(lat, lng); k ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y) })
          ctx.closePath(); ctx.stroke()
        })
        ctx.restore()

        // Graticule — bold lat/lng grid
        ctx.save()
        ctx.strokeStyle = 'rgba(150,195,240,0.22)'; ctx.lineWidth = 1
        for (let lat = -75; lat <= 75; lat += 15) {
          const a = projGeo(lat, -178), b = projGeo(lat, 178)
          if (a.y < -80 || a.y > H + 80) continue
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
        for (let lng = -180; lng <= 180; lng += 15) {
          const a = projGeo(-80, lng), b = projGeo(85, lng)
          if (a.x < -80 || a.x > W + 80) continue
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        }
        // Brighter anchor lines — equator + prime meridian + tropics
        ctx.strokeStyle = 'rgba(170,210,250,0.55)'; ctx.lineWidth = 1.6
        ;[0, 23.5, -23.5].forEach(lat => {
          const a = projGeo(lat, -178), b = projGeo(lat, 178)
          if (a.y < -80 || a.y > H + 80) return
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
        })
        { const a = projGeo(-80, 0), b = projGeo(85, 0)
          ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke() }
        ctx.restore()

        // Tethers — node → its home glow (drawn behind rings/nodes)
        ctx.save()
        ctx.setLineDash([2, 5]); ctx.lineWidth = 0.8
        layout.forEach(m => {
          if (!m.coords) return
          const np = nodePos(m._ring, m._angle, rot, CX, CY)
          const g  = projGeo(m.coords.lat, m.coords.lng)
          ctx.globalAlpha = (hovId === m.id ? 0.65 : 0.32)
          ctx.strokeStyle = 'rgba(170,210,240,0.9)'
          ctx.beginPath(); ctx.moveTo(np.x, np.y); ctx.lineTo(g.x, g.y); ctx.stroke()
        })
        ctx.setLineDash([]); ctx.restore()

        // Home glows + names — prominent
        const tNow = Date.now() / 1000
        geo.locations.forEach((loc, i) => {
          const g = projGeo(loc.lat, loc.lng)
          if (g.x < -60 || g.x > W + 60 || g.y < -60 || g.y > H + 60) return
          const col = loc.alive !== false ? '90,200,110' : '220,180,60'
          const pulse = 0.5 + 0.5 * Math.sin(tNow * 1.1 + i * 0.7)
          const gg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 40)
          gg.addColorStop(0, `rgba(${col},${0.42 + pulse * 0.12})`); gg.addColorStop(1, `rgba(${col},0)`)
          ctx.beginPath(); ctx.arc(g.x, g.y, 40, 0, Math.PI * 2); ctx.fillStyle = gg; ctx.fill()
          ctx.beginPath(); ctx.arc(g.x, g.y, 9 + pulse * 2, 0, Math.PI * 2)
          ctx.strokeStyle = `rgba(${col},0.5)`; ctx.lineWidth = 1; ctx.stroke()
          ctx.beginPath(); ctx.arc(g.x, g.y, 3.4, 0, Math.PI * 2); ctx.fillStyle = `rgba(${col},1)`; ctx.fill()
          ctx.save()
          ctx.globalAlpha = 0.82
          ctx.font = `700 10px 'Inter',-apple-system,sans-serif`
          ctx.fillStyle = '#dff0ff'; ctx.textAlign = 'center'; ctx.textBaseline = 'top'
          ctx.fillText(loc.name?.split(' ')[0] || '', g.x, g.y + 11)
          ctx.restore()
        })
      }

      // ── Orbital rings — tilted ellipses (the 3D disc) ──────────────────────
      ;[3, 2, 1].forEach(ri => {
        ctx.save()
        ctx.globalAlpha = RING_ALPHA[ri]
        ctx.beginPath(); ctx.ellipse(CX, CY, RING_R[ri], RING_R[ri] * TILT_Y, 0, 0, Math.PI * 2)
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

      // ── Nodes (outer first → inner draws on top) ──────────────────────────
      ;[3, 2, 1].forEach(ri => {
        const rMembers = layout.filter(m => m._ring === ri)
        if (!rMembers.length) return

        // Draw back-to-front so nearer (front) nodes overlap farther ones.
        rMembers
          .map(m => ({ m, p: nodePos(m._ring, m._angle, rot, CX, CY) }))
          .sort((a, b) => a.p.depth - b.p.depth)
          .forEach(({ m, p }) => {
          const depthN = p.depth * 0.5 + 0.5            // 0 = back … 1 = front
          const R   = NODE_R[m._ring] * (0.78 + 0.22 * depthN)
          const c   = nc(m.alive)
          const hov = hovId === m.id

          if (hov) {
            ctx.beginPath(); ctx.arc(p.x, p.y, R + 8, 0, Math.PI * 2)
            ctx.strokeStyle = `${c.g}0.45)`; ctx.lineWidth = 1.1; ctx.stroke()
            const grd = ctx.createRadialGradient(p.x, p.y, R, p.x, p.y, R + 22)
            grd.addColorStop(0, `${c.g}0.30)`)
            grd.addColorStop(1, `${c.g}0.00)`)
            ctx.beginPath(); ctx.arc(p.x, p.y, R + 22, 0, Math.PI * 2)
            ctx.fillStyle = grd; ctx.fill()
          }

          ctx.save()
          ctx.globalAlpha = RING_ALPHA[ri] * (0.78 + 0.22 * depthN)   // back nodes recede
          const nodeBlur = RING_BLUR[ri] + (1 - depthN) * 1.1         // + depth-of-field
          if (nodeBlur > 0.05) ctx.filter = `blur(${nodeBlur}px)`

          const img = m.photo ? loadImg(m.photo, m.id) : null
          if (img?.complete && img.naturalWidth > 0) {
            ctx.save(); ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
            ctx.clip(); ctx.drawImage(img, p.x - R, p.y - R, R * 2, R * 2); ctx.restore()
          } else {
            ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
            ctx.fillStyle = c.f; ctx.fill()
          }

          ctx.beginPath(); ctx.arc(p.x, p.y, R, 0, Math.PI * 2)
          ctx.strokeStyle = c.s; ctx.lineWidth = 0.9; ctx.stroke()
          ctx.restore()

          // Status dot — sharp
          const da = Math.PI * 0.22
          ctx.beginPath()
          ctx.arc(p.x + R * Math.cos(da), p.y + R * Math.sin(da), 3, 0, Math.PI * 2)
          ctx.fillStyle = c.s; ctx.fill()

          // Initials when no photo
          const hasPhoto = img?.complete && img.naturalWidth > 0
          if (!hasPhoto) {
            ctx.save()
            ctx.globalAlpha = RING_ALPHA[ri]
            ctx.font = `600 ${Math.round(R * 0.48)}px 'Inter',-apple-system,sans-serif`
            ctx.fillStyle = c.t; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
            ctx.fillText((m.avatar || m.name?.slice(0, 2) || '?').toUpperCase(), p.x, p.y)
            ctx.restore()
          }

          // ── Name + relation labels (ring 1 only) ────────────────────────
          if (m._ring === 1) {
            ctx.save()
            ctx.globalAlpha = hov ? 0.95 : 0.78
            ctx.font = `600 10.5px 'Inter',-apple-system,sans-serif`
            ctx.fillStyle = '#fff'
            ctx.textAlign = 'center'
            ctx.textBaseline = 'top'
            ctx.fillText(fit(ctx, m.name?.split(' ')[0] || '', 90), p.x, p.y + R + 8)

            if (m.relation) {
              ctx.globalAlpha = hov ? 0.85 : 0.55
              ctx.font = `500 9px 'Inter',-apple-system,sans-serif`
              ctx.fillStyle = '#FFD700'
              ctx.fillText(fit(ctx, m.relation, 110), p.x, p.y + R + 22)
            }
            ctx.restore()
          } else if (m._ring === 2 && hov) {
            // Show relation on hover for ring 2 too
            ctx.save()
            ctx.globalAlpha = 0.85
            ctx.font = `500 9px 'Inter',-apple-system,sans-serif`
            ctx.fillStyle = '#FFD700'
            ctx.textAlign = 'center'; ctx.textBaseline = 'top'
            ctx.fillText(fit(ctx, m.relation || '', 110), p.x, p.y + R + 6)
            ctx.restore()
          }
        })
      })

      // ── Center node ────────────────────────────────────────────────────────
      if (centerObj) {
        const c = nc(centerObj.alive)
        const t = Date.now() / 1000

        // Ambient glow
        const ag = ctx.createRadialGradient(CX, CY, CENTER_R * 0.3, CX, CY, CENTER_R + 60)
        ag.addColorStop(0, `${c.g}0.20)`)
        ag.addColorStop(1, `${c.g}0.00)`)
        ctx.beginPath(); ctx.arc(CX, CY, CENTER_R + 60, 0, Math.PI * 2)
        ctx.fillStyle = ag; ctx.fill()

        // Breathing rings
        ;[CENTER_R + 18, CENTER_R + 9].forEach((r, i) => {
          const pulse = 0.5 + 0.5 * Math.sin(t * (i === 0 ? 0.9 : 1.2) + i * 0.7)
          ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2)
          ctx.strokeStyle = `${c.g}${i === 0 ? 0.10 + pulse * 0.10 : 0.30 + pulse * 0.20})`
          ctx.lineWidth = i === 0 ? 1 : 1.4; ctx.stroke()
        })

        // Background
        const cKey = (centerObj.id || 'center') + '_c'
        const img = centerObj.photo ? loadImg(centerObj.photo, cKey) : null
        if (img?.complete && img.naturalWidth > 0) {
          ctx.save()
          ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2); ctx.clip()
          ctx.drawImage(img, CX - CENTER_R, CY - CENTER_R, CENTER_R * 2, CENTER_R * 2)
          ctx.restore()
        } else {
          ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
          ctx.fillStyle = c.f; ctx.fill()
          const ig = ctx.createRadialGradient(CX - 10, CY - 10, 0, CX, CY, CENTER_R)
          ig.addColorStop(0, `${c.g}0.20)`)
          ig.addColorStop(1, `${c.g}0.02)`)
          ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
          ctx.fillStyle = ig; ctx.fill()
        }

        // Gold border (memorial centre uses richer ring)
        ctx.beginPath(); ctx.arc(CX, CY, CENTER_R, 0, Math.PI * 2)
        ctx.strokeStyle = centerObj.isMemorial ? 'rgba(255,215,0,0.75)' : `${c.g}0.65)`
        ctx.lineWidth   = 1.8
        ctx.stroke()

        // Initials fallback
        const cHas = img?.complete && img.naturalWidth > 0
        if (!cHas) {
          ctx.font = `700 22px 'Cormorant Garamond',Georgia,serif`
          ctx.fillStyle = centerObj.isMemorial ? '#FFD700' : `${c.g}0.85)`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillText((centerObj.avatar || centerObj.name?.slice(0, 2) || 'ME').toUpperCase(), CX, CY)
        }

        // Centre name + role under the disc
        ctx.save()
        ctx.globalAlpha = 0.90
        ctx.font = `700 14px 'Cormorant Garamond',Georgia,serif`
        ctx.fillStyle = '#fff'
        ctx.textAlign = 'center'; ctx.textBaseline = 'top'
        ctx.fillText(fit(ctx, centerObj.name || '', 220), CX, CY + CENTER_R + 12)

        const subtitle = centerObj.isMemorial ? '✦ Centre of the circle'
                       : centerObj.relation   ? centerObj.relation
                       : null
        if (subtitle) {
          ctx.globalAlpha = 0.55
          ctx.font = `500 9.5px 'Inter',-apple-system,sans-serif`
          ctx.fillStyle = '#FFD700'
          ctx.fillText(fit(ctx, subtitle, 230), CX, CY + CENTER_R + 30)
        }
        ctx.restore()
      }

      rafRef.current = requestAnimationFrame(frame)
    }

    const onImgLoad = () => { cancelAnimationFrame(rafRef.current); rafRef.current = requestAnimationFrame(frame) }
    imgLoadCbs.add(onImgLoad)

    rafRef.current = requestAnimationFrame(frame)
    return () => { cancelAnimationFrame(rafRef.current); imgLoadCbs.delete(onImgLoad) }
  }, [])

  // ── Hit test, pan, click ───────────────────────────────────────────────────

  const hitTest = useCallback((cx, cy) => {
    const canvas = canvasRef.current; if (!canvas) return null
    const W = canvas.width, H = canvas.height
    const CX = W / 2 + panRef.current.x
    const CY = H / 2 + panRef.current.y
    const rot = rotRef.current
    if (Math.hypot(cx - CX, cy - CY) <= CENTER_R + 8) return { _center: true }
    for (const ri of [1, 2, 3]) {
      for (const m of layoutRef.current.filter(d => d._ring === ri)) {
        const p = nodePos(m._ring, m._angle, rot, CX, CY)
        if (Math.hypot(cx - p.x, cy - p.y) <= NODE_R[m._ring] + 12) return m
      }
    }
    return null
  }, [])

  function startDrag(x, y) {
    dragRef.current = { startX: x, startY: y, startPanX: panRef.current.x, startPanY: panRef.current.y }
    movedRef.current = false
  }
  function moveDrag(x, y) {
    if (!dragRef.current) return
    const dx = x - dragRef.current.startX
    const dy = y - dragRef.current.startY
    if (Math.hypot(dx, dy) > 3) movedRef.current = true
    panRef.current = {
      x: dragRef.current.startPanX + dx,
      y: dragRef.current.startPanY + dy,
    }
    setPanBadge(Math.hypot(panRef.current.x, panRef.current.y) > 80)
    onPanChange?.(panRef.current)
  }
  function endDrag() { dragRef.current = null }

  const handleMouseDown = useCallback(e => { startDrag(e.clientX, e.clientY) }, [])
  const handleMouseMove = useCallback(e => {
    if (dragRef.current) {
      moveDrag(e.clientX, e.clientY)
      return
    }
    const h = hitTest(e.clientX, e.clientY)
    hovRef.current = h && !h._center ? h.id : null
    canvasRef.current.style.cursor = h ? 'pointer' : 'grab'
  }, [hitTest])
  const handleMouseUp = useCallback(e => {
    const wasDragging = movedRef.current
    endDrag()
    if (wasDragging) return
    const h = hitTest(e.clientX, e.clientY)
    if (!h) return
    if (h._center) { onCenterClick?.(); return }
    onSelectMember?.(h)
  }, [hitTest, onSelectMember, onCenterClick])

  const handleTouchStart = useCallback(e => {
    const t = e.touches[0]
    if (t) startDrag(t.clientX, t.clientY)
  }, [])
  const handleTouchMove = useCallback(e => {
    const t = e.touches[0]
    if (t) moveDrag(t.clientX, t.clientY)
  }, [])
  const handleTouchEnd = useCallback(e => {
    e.preventDefault()
    const wasDragging = movedRef.current
    const t = e.changedTouches[0]
    endDrag()
    if (wasDragging || !t) return
    const h = hitTest(t.clientX, t.clientY)
    if (!h) return
    if (h._center) { onCenterClick?.(); return }
    onSelectMember?.(h)
  }, [hitTest, onSelectMember, onCenterClick])

  return (
    <>
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={endDrag}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position:'fixed', top:0, left:0, width:'100%', height:'100%',
          display:'block', touchAction:'none', cursor: 'grab', zIndex:1,
        }}
      />

      {/* Dreamy depth-of-field — blur ramps toward the extreme edges and clears
          in the centre, so panning a member inward brings them into focus.
          pointer-events:none → never blocks dragging/clicking the canvas. */}
      <div aria-hidden style={{
        position:'fixed', inset:0, zIndex:2, pointerEvents:'none',
        backdropFilter:'blur(9px)', WebkitBackdropFilter:'blur(9px)',
        maskImage:'radial-gradient(118% 118% at 50% 48%, transparent 36%, rgba(0,0,0,0.55) 68%, #000 100%)',
        WebkitMaskImage:'radial-gradient(118% 118% at 50% 48%, transparent 36%, rgba(0,0,0,0.55) 68%, #000 100%)',
      }} />

      {/* Cinematic vignette — deepens the edges so the web feels recessed and 3D. */}
      <div aria-hidden style={{
        position:'fixed', inset:0, zIndex:3, pointerEvents:'none',
        background:'radial-gradient(125% 125% at 50% 44%, transparent 46%, rgba(5,6,14,0.45) 76%, rgba(2,3,9,0.92) 100%)',
      }} />

      {/* Pan-back-to-centre badge */}
      {panBadge && (
        <button
          onClick={() => {
            const start = { ...panRef.current }
            const t0 = performance.now()
            const dur = 420
            function step(t) {
              const k = Math.min(1, (t - t0) / dur)
              const ease = 1 - Math.pow(1 - k, 3)
              panRef.current = { x: start.x * (1 - ease), y: start.y * (1 - ease) }
              if (k < 1) requestAnimationFrame(step)
              else { panRef.current = { x: 0, y: 0 }; setPanBadge(false); onPanChange?.(panRef.current) }
            }
            requestAnimationFrame(step)
          }}
          style={{
            position: 'fixed',
            bottom: 'calc(86px + env(safe-area-inset-bottom))',
            left: '50%', transform: 'translateX(-50%)',
            zIndex: 25,
            background: 'rgba(10,10,15,0.85)',
            border: '1px solid rgba(255,215,0,0.40)',
            color: 'rgba(255,215,0,0.95)',
            borderRadius: 999,
            padding: '8px 18px',
            fontFamily: "'Inter',sans-serif",
            fontSize: 11, fontWeight: 700, letterSpacing: '.10em',
            cursor: 'pointer',
            backdropFilter: 'blur(20px)',
            boxShadow: '0 6px 30px rgba(0,0,0,0.55)',
          }}
        >
          ◎ Re-centre
        </button>
      )}
    </>
  )
}
