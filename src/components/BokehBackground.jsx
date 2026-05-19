// src/components/BokehBackground.jsx — dark theme

const BLOBS = [
  { w:600,h:600, top:'-15%', left:'-10%', color:'rgba(255,215,0,0.12)',  blur:140, dur:20 },
  { w:500,h:500, top:'60%',  left:'-8%',  color:'rgba(56,189,248,0.10)', blur:120, dur:25, delay:4 },
  { w:550,h:550, top:'-10%', right:'-8%', color:'rgba(78,205,196,0.09)', blur:130, dur:22, delay:7 },
  { w:480,h:480, top:'45%',  right:'-6%', color:'rgba(255,215,0,0.08)',  blur:110, dur:18, delay:10 },
  { w:420,h:420, top:'25%',  left:'28%',  color:'rgba(192,132,252,0.07)',blur:100, dur:30, delay:14 },
]

export default function BokehBackground() {
  return (
    <div
      aria-hidden="true"
      style={{
        position:'fixed', inset:0, zIndex:0,
        overflow:'hidden', pointerEvents:'none',
        background:'#08080f',
      }}
    >
      {BLOBS.map((b, i) => (
        <div key={i} style={{
          position:'absolute',
          width:b.w, height:b.h,
          top:b.top, left:b.left, right:b.right,
          borderRadius:'50%',
          background:`radial-gradient(circle at 40% 40%, ${b.color}, transparent 70%)`,
          filter:`blur(${b.blur}px)`,
          animation:`float ${b.dur}s ease-in-out ${b.delay||0}s infinite alternate`,
        }} />
      ))}
    </div>
  )
}
