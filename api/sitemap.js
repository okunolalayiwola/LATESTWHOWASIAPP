// api/sitemap.js
// GET /sitemap.xml  (via vercel.json rewrite)
// Env: INSTANTDB_ADMIN_TOKEN, NEXT_PUBLIC_APP_URL

const APP = process.env.NEXT_PUBLIC_APP_URL || 'https://whowasi.uk'

const STATIC = [
  { path:'/',        freq:'weekly',  pri:'1.0' },
  { path:'/explore', freq:'hourly',  pri:'0.9' },
  { path:'/premium', freq:'monthly', pri:'0.6' },
  { path:'/privacy', freq:'yearly',  pri:'0.3' },
  { path:'/terms',   freq:'yearly',  pri:'0.3' },
]

export default async function handler(req, res) {
  let memorials = []
  try {
    const r = await fetch('https://api.instantdb.com/admin/query', {
      method:'POST',
      headers:{ 'Content-Type':'application/json', Authorization:`Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}` },
      body:JSON.stringify({ query:{ memorials:{ $:{ where:{ visibility:'public' }, limit:5000 } } } })
    })
    memorials = (await r.json())?.memorials || []
  } catch {}

  const today = new Date().toISOString().split('T')[0]

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${STATIC.map(({ path, freq, pri }) => `  <url>
    <loc>${APP}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${freq}</changefreq>
    <priority>${pri}</priority>
  </url>`).join('\n')}
${memorials.map(m => `  <url>
    <loc>${APP}/memorial/${m.id}</loc>
    <lastmod>${m.updatedAt ? new Date(m.updatedAt).toISOString().split('T')[0] : today}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')}
</urlset>`

  res.setHeader('Content-Type', 'application/xml; charset=utf-8')
  res.setHeader('Cache-Control', 'public, max-age=43200, stale-while-revalidate=86400')
  return res.send(xml)
}
