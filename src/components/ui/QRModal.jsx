// src/components/ui/QRModal.jsx
// Neutral black & white QR code — clean, minimal, works on any surface.
// Uses qrserver.com for the QR data, composites on a white canvas.
// The QR always links to the memorial profile page (public shows content, private shows locked).

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function QRModal({ url, name, onClose }) {
  const canvasRef = useRef(null)
  const [copied,   setCopied]   = useState(false)
  const [rendered, setRendered] = useState(false)

  // QR data from free API — black on white, no colour
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&bgcolor=ffffff&color=000000&margin=20&data=${encodeURIComponent(url)}`

  // ── Draw neutral canvas ─────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')

    const W = 420, H = 580
    canvas.width  = W
    canvas.height = H

    // White background
    ctx.fillStyle = '#ffffff'
    ctx.roundRect ? ctx.roundRect(0, 0, W, H, 20) : ctx.rect(0, 0, W, H)
    ctx.fill()

    // Thin black border
    ctx.strokeStyle = 'rgba(0,0,0,0.08)'
    ctx.lineWidth   = 1
    if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(6, 6, W-12, H-12, 16); ctx.stroke() }

    // Top section: WHO WAS I — black text
    ctx.fillStyle   = '#000000'
    ctx.font        = 'bold 14px Inter, -apple-system, sans-serif'
    ctx.textAlign   = 'center'
    ctx.fillText('WHO WAS I', W/2, 38)

    // Thin grey line under logo
    const grd = ctx.createLinearGradient(40, 50, W-40, 50)
    grd.addColorStop(0, 'transparent')
    grd.addColorStop(0.3, 'rgba(0,0,0,0.12)')
    grd.addColorStop(0.7, 'rgba(0,0,0,0.12)')
    grd.addColorStop(1, 'transparent')
    ctx.fillStyle = grd
    ctx.fillRect(40, 50, W-80, 1)

    // Memorial name below logo
    ctx.fillStyle = '#000000'
    ctx.font      = `bold ${name && name.length > 18 ? 15 : 18}px Inter, -apple-system, sans-serif`
    ctx.fillText(name || 'Memorial', W/2, 80)

    // Load QR code image
    const img = new window.Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => {
      const qrX = 60, qrY = 100, qrS = W - 120

      // Corner brackets — thin black
      const BL = 20
      const BW = 2
      ctx.strokeStyle = '#000000'
      ctx.lineWidth   = BW
      ctx.lineCap     = 'square'
      const brackets = [
        [qrX, qrY,                   1, 1 ],
        [qrX + qrS, qrY,            -1, 1 ],
        [qrX, qrY + qrS,             1, -1],
        [qrX + qrS, qrY + qrS,      -1, -1],
      ]
      brackets.forEach(([bx, by, dx, dy]) => {
        ctx.beginPath(); ctx.moveTo(bx, by + dy * BL); ctx.lineTo(bx, by); ctx.lineTo(bx + dx * BL, by); ctx.stroke()
      })

      // Clip and draw QR
      ctx.save()
      ctx.beginPath()
      ctx.rect(qrX, qrY, qrS, qrS)
      ctx.clip()
      ctx.drawImage(img, qrX, qrY, qrS, qrS)
      ctx.restore()

      // URL strip below QR
      const urlY = qrY + qrS + 22
      ctx.fillStyle = 'rgba(0,0,0,0.04)'
      ctx.beginPath()
      if (ctx.roundRect) { ctx.roundRect(40, urlY - 12, W-80, 22, 6) } else { ctx.rect(40, urlY-12, W-80, 22) }
      ctx.fill()
      ctx.fillStyle = 'rgba(0,0,0,0.35)'
      ctx.font      = '9px Inter, sans-serif'
      const shortUrl = url.replace('https://', '').slice(0, 40)
      ctx.fillText(shortUrl, W/2, urlY + 3)

      // Bottom tagline
      ctx.fillStyle = 'rgba(0,0,0,0.50)'
      ctx.font      = 'bold 9px Inter, sans-serif'
      ctx.fillText('SCAN TO VISIT', W/2, H - 48)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.font      = '8px Inter, sans-serif'
      ctx.fillText('Print on headstones, cards, wreaths & programs', W/2, H - 30)

      // Bottom grey line
      ctx.fillStyle = grd
      ctx.fillRect(40, H - 18, W-80, 1)

      setRendered(true)
    }
    img.onerror = () => {
      ctx.fillStyle = 'rgba(0,0,0,0.30)'
      ctx.font      = '11px Inter, sans-serif'
      ctx.fillText('QR code loading…', W/2, H/2)
      setRendered(true)
    }
    img.src = qrApiUrl

  }, [url, name])

  async function handleDownload() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob(blob => {
      const href = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = href
      a.download = `who-was-i-${name?.toLowerCase().replace(/\s+/g,'-') || 'memorial'}-qr.png`
      a.click()
      URL.revokeObjectURL(href)
    }, 'image/png')
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
        onClick={onClose}
        style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex: 200, backdropFilter:'blur(8px)' }}
      />

      <motion.div
        initial={{ opacity:0, scale:0.92, y:24 }}
        animate={{ opacity:1, scale:1,    y:0   }}
        exit={{   opacity:0, scale:0.92, y:24   }}
        transition={{ type:'spring', damping:26, stiffness:280 }}
        style={{ position:'fixed', inset:0, zIndex: 201, display:'flex',
          alignItems:'center', justifyContent:'center', padding:24, pointerEvents:'none' }}
      >
        <div className="w-full max-w-xs bg-white rounded-3xl p-5 text-center shadow-2xl"
          style={{ pointerEvents:'auto', position:'relative' }}>

          <button onClick={onClose}
            className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center text-black/30 hover:text-black text-xs">
            ✕
          </button>

          <p className="text-[0.6rem] font-bold tracking-[0.22em] uppercase text-black/40 mb-1">Memorial QR Code</p>
          <h2 className="text-xl font-bold text-black mb-4">{name}</h2>

          {/* Canvas */}
          <div className="relative mx-auto mb-4 rounded-2xl overflow-hidden bg-white"
            style={{ width:280, height: 280 * (580/420) }}>
            {!rendered && (
              <div className="absolute inset-0 flex items-center justify-center bg-white rounded-2xl">
                <div className="w-8 h-8 border-2 border-black/20 border-t-black rounded-full animate-spin" />
              </div>
            )}
            <canvas ref={canvasRef}
              style={{ width:'100%', height:'100%', display: rendered ? 'block' : 'none', borderRadius:16 }}
            />
          </div>

          <p className="text-xs text-black/40 mb-4 leading-relaxed">
            Print on headstones, wreaths, cards, or funeral programs.
          </p>

          <div className="flex gap-2">
            <button onClick={handleCopy}
              className={`flex-1 py-3 rounded-xl text-xs font-semibold transition-all ${
                copied ? 'bg-black/10 border border-black/20 text-black' : 'bg-black/5 text-black/60 hover:text-black hover:bg-black/10'
              }`}>
              {copied ? '✓ Copied' : 'Copy link'}
            </button>
            <button onClick={handleDownload}
              className="flex-[1.5] py-3 rounded-xl text-xs font-bold bg-black text-white hover:opacity-90">
              ↓ Download
            </button>
          </div>

          {navigator.share && (
            <button onClick={() => navigator.share({ title: name, url }).catch(()=>{})}
              className="w-full mt-2 py-3 rounded-xl text-xs text-black/50 hover:text-black hover:bg-black/5">
              Share via…
            </button>
          )}
        </div>
      </motion.div>
    </>
  )
}
