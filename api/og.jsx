// api/og.jsx   →   /memorial/:id/og  (via vercel.json rewrite)
// npm install @vercel/og
// Env: INSTANTDB_ADMIN_TOKEN

import { ImageResponse } from '@vercel/og'

export const config = { runtime: 'edge' }

const APP = 'https://whowasi.uk'

export default async function handler(req) {
  const { searchParams } = new URL(req.url)
  const memorialId = searchParams.get('id')

  let name     = 'A Beloved Soul'
  let years    = ''
  let subtitle = 'A living memorial on WHO WAS I'
  let photoUrl = null

  if (memorialId) {
    try {
      const r    = await fetch('https://api.instantdb.com/admin/query', {
        method:'POST',
        headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
        body:JSON.stringify({ query:{ memorials:{ $:{ where:{ id:memorialId } } } } })
      })
      const m = (await r.json())?.memorials?.[0]
      if (m) {
        name     = m.name || name
        years    = m.years || (m.birthYear ? `${m.birthYear}${m.deathYear ? ` — ${m.deathYear}` : ''}` : '')
        subtitle = m.subtitle || m.bio?.slice(0, 80) || subtitle
        photoUrl = m.coverPhoto || m.photo || null
      }
    } catch {}
  }

  return new ImageResponse(
    (
      <div style={{ display:'flex', width:'100%', height:'100%', background:'#08080f', position:'relative', overflow:'hidden' }}>

        {/* Glow blobs */}
        <div style={{ position:'absolute', top:'-10%', left:'-5%', width:'50%', height:'60%', borderRadius:'50%', background:'radial-gradient(circle, rgba(255,215,0,0.12), transparent)', filter:'blur(60px)' }} />
        <div style={{ position:'absolute', bottom:'-10%', right:'-5%', width:'45%', height:'55%', borderRadius:'50%', background:'radial-gradient(circle, rgba(56,189,248,0.10), transparent)', filter:'blur(60px)' }} />

        {/* Photo left side */}
        {photoUrl && (
          <div style={{ width:'40%', height:'100%', position:'relative', overflow:'hidden', flexShrink:0 }}>
            <img src={photoUrl} style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }} />
            <div style={{ position:'absolute', inset:0, background:'linear-gradient(to right, transparent 55%, #08080f 100%)' }} />
          </div>
        )}

        {/* Text right side */}
        <div style={{ display:'flex', flexDirection:'column', justifyContent:'center', padding:'60px 56px 60px 36px', flex:1 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:'0.20em', textTransform:'uppercase', color:'rgba(255,215,0,0.65)', marginBottom:14 }}>
            In loving memory · WHO WAS I
          </div>
          <div style={{ fontSize: photoUrl ? 50 : 62, fontWeight:700, color:'#fff', lineHeight:1.1, marginBottom:10 }}>
            {name}
          </div>
          {years && (
            <div style={{ fontSize:20, color:'rgba(255,255,255,0.45)', marginBottom:14 }}>{years}</div>
          )}
          {subtitle && (
            <div style={{ fontSize:15, color:'rgba(255,255,255,0.36)', lineHeight:1.55, maxWidth:400 }}>
              {subtitle.length > 90 ? subtitle.slice(0,90) + '…' : subtitle}
            </div>
          )}
          <div style={{ marginTop:38, fontSize:12, color:'rgba(255,215,0,0.38)', fontWeight:600, letterSpacing:'0.10em' }}>
            whowasi.uk
          </div>
        </div>
      </div>
    ),
    { width:1200, height:630 }
  )
}
