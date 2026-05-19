// api/delete-account.js
// GDPR cascade deletion. POST { userId }
// Env: INSTANTDB_ADMIN_TOKEN (same as INSTANT_APP_ADMIN_TOKEN in .env — use that value)

const DB    = 'https://api.instantdb.com/admin'
const auth  = () => ({ Authorization: `Bearer ${process.env.INSTANTDB_ADMIN_TOKEN}`, 'Content-Type': 'application/json' })

async function q(query) {
  const r = await fetch(`${DB}/query`, { method:'POST', headers:auth(), body:JSON.stringify({ query }) })
  return r.json()
}
async function del(entity, id) {
  await fetch(`${DB}/transact`, {
    method:'POST', headers:auth(),
    body:JSON.stringify({ steps:[{ action:'delete', entity, id }] })
  })
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()
  const { userId } = req.body
  if (!userId) return res.status(400).json({ error: 'Missing userId' })

  const deleted = { profiles:0, memorials:0, tributes:0, photos:0, letters:0, familyMembers:0, invites:0 }

  try {
    // 1. Profile
    const pd = await q({ profiles: { $: { where: { userId } } } })
    for (const p of pd?.profiles || []) { await del('profiles', p.id); deleted.profiles++ }

    // 2. Memorials + linked data
    const md = await q({ memorials: { $:{ where:{ creatorId:userId } }, tributes:{}, photos:{}, letters:{} } })
    for (const m of md?.memorials || []) {
      for (const t of m.tributes || []) { await del('tributes', t.id); deleted.tributes++ }
      for (const p of m.photos   || []) { await del('photos',   p.id); deleted.photos++ }
      for (const l of m.letters  || []) { await del('letters',  l.id); deleted.letters++ }
      await del('memorials', m.id); deleted.memorials++
    }

    // 3. Tributes left on others' memorials
    const td = await q({ tributes: { $: { where: { authorId: userId } } } })
    for (const t of td?.tributes || []) { await del('tributes', t.id); deleted.tributes++ }

    // 4. Family members
    const fd = await q({ familyMembers: { $: { where: { ownerId: userId } } } })
    for (const f of fd?.familyMembers || []) { await del('familyMembers', f.id); deleted.familyMembers++ }

    // 5. Invites
    const id2 = await q({ invites: { $: { where: { familyOwnerId: userId } } } })
    for (const inv of id2?.invites || []) { await del('invites', inv.id); deleted.invites++ }

    // 6. $users record
    await fetch(`${DB}/transact`, {
      method:'POST', headers:auth(),
      body:JSON.stringify({ steps:[{ action:'delete', entity:'$users', id:userId }] })
    }).catch(()=>{})

    return res.json({ ok:true, deleted })
  } catch (err) {
    console.error('[delete-account]', err)
    return res.status(500).json({ error: err.message })
  }
}
