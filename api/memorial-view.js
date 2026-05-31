// api/memorial-view.js — increment a memorial's view counter.
//
// POST { memorialId }
//
// Memorials are owner-only writable under the DB perms, so visitors can't bump
// the counter from the client. This runs server-side with the admin token. The
// client guards with a per-session flag, so this is at most one call per viewer
// per session. Best-effort: any failure is swallowed (a missed view is fine).
//
// Env: VITE_INSTANT_APP_ID, INSTANTDB_ADMIN_TOKEN

import { init } from '@instantdb/admin'

const APP_ID = process.env.VITE_INSTANT_APP_ID
const TOKEN  = process.env.INSTANTDB_ADMIN_TOKEN

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  if (!APP_ID || !TOKEN)     return res.status(500).json({ error: 'View service is not configured' })

  const { memorialId } = req.body || {}
  if (!memorialId) return res.status(400).json({ error: 'Missing memorialId' })

  try {
    const db   = init({ appId: APP_ID, adminToken: TOKEN })
    const data = await db.query({ memorials: { $: { where: { id: memorialId } } } })
    const m    = data?.memorials?.[0]
    if (!m) return res.status(404).json({ error: 'Memorial not found' })

    const next = (m.viewCount || 0) + 1
    await db.transact([ db.tx.memorials[memorialId].update({ viewCount: next }) ])
    return res.json({ ok: true, viewCount: next })
  } catch (err) {
    console.error('[memorial-view]', err)
    return res.status(500).json({ error: 'Could not record view' })
  }
}
