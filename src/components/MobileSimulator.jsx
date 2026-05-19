import { useState, useEffect } from 'react'

const DEVICES = [
  { name: 'iPhone 15 Pro', width: 393, height: 852 },
  { name: 'iPhone 15', width: 390, height: 844 },
  { name: 'iPhone 14 Pro Max', width: 430, height: 932 },
  { name: 'Pixel 8 Pro', width: 412, height: 915 },
  { name: 'Samsung Galaxy S24', width: 360, height: 780 },
  { name: 'iPad Pro 12.9"', width: 1024, height: 1366 },
]

export default function MobileSimulator({ url }) {
  const [isOpen, setIsOpen] = useState(false)
  const [device, setDevice] = useState(DEVICES[0])
  const [scale, setScale] = useState(0.8)

  useEffect(() => {
    const updateScale = () => {
      const maxW = window.innerWidth * 0.85
      const maxH = window.innerHeight * 0.8
      const scaleW = maxW / device.width
      const scaleH = maxH / device.height
      setScale(Math.min(scaleW, scaleH, 1))
    }
    updateScale()
    window.addEventListener('resize', updateScale)
    return () => window.removeEventListener('resize', updateScale)
  }, [device])

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full bg-gradient-to-r from-gold to-sky text-black shadow-lg shadow-gold/30 flex items-center justify-center hover:scale-110 transition-transform"
        title="Open Mobile Simulator"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
        </svg>
      </button>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center">
      {/* Controls */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <select
            value={device.name}
            onChange={e => setDevice(DEVICES.find(d => d.name === e.target.value) || DEVICES[0])}
            className="bg-white/10 border border-white/20 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none"
          >
            {DEVICES.map(d => (
              <option key={d.name} value={d.name} className="bg-black text-white">{d.name}</option>
            ))}
          </select>
          <span className="text-[0.55rem] text-white/40">{device.width}×{device.height}</span>
        </div>
        <button
          onClick={() => setIsOpen(false)}
          className="text-xs text-white/60 hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg transition-all"
        >
          Close ✕
        </button>
      </div>

      {/* Phone Frame */}
      <div
        className="relative"
        style={{
          width: device.width * scale,
          height: device.height * scale,
        }}
      >
        {/* Device frame */}
        <div className="absolute inset-0 rounded-[3rem] border-2 border-white/20 shadow-2xl overflow-hidden bg-black">
          {/* Notch */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-7 bg-black rounded-b-2xl z-10 flex items-center justify-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/20" />
            <div className="w-16 h-1.5 rounded-full bg-white/10" />
          </div>

          {/* Screen */}
          <iframe
            src={url}
            className="w-full h-full border-0"
            style={{ borderRadius: 'calc(3rem - 2px)' }}
            title="Mobile Simulator"
          />
        </div>

        {/* QR Code hint */}
        <div className="absolute -bottom-12 left-1/2 -translate-x-1/2 text-center">
          <p className="text-[0.55rem] text-white/30 tracking-wider">
            Or open on your phone: <span className="text-gold">{window.location.hostname}:5173</span>
          </p>
        </div>
      </div>
    </div>
  )
}
