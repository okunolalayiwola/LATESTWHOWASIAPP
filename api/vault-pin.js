// api/vault-pin.js — Legacy Vault shared PIN, verified server-side.
//
// POST { action, memorialId, pin, userId?, currentPin? }
//   action 'set'    — create or replace the vault PIN.
//                     · first-time setup is creator-only (creatorId === userId,
//                       or a legacy memorial with no creatorId)
//                     · changing an existing PIN requires the current PIN,
//                       unless the requester is the creator (recovery / reset)
//   action 'verify' — check a PIN. Rate-limited to blunt 6-digit brute force.
//
// The stored hash is peppered with a server-only secret (VAULT_PIN_PEPPER), so
// the value persisted on the memorial is safe to expose to clients — the PIN is
// the single shared secret. Anyone who knows it can open the vault on any
// device, regardless of relationship.
//
// Env: VITE_INSTANT_APP_ID, INSTANTDB_ADMIN_TOKEN, VAULT_PIN_PEPPER (recommended)

import crypto from 'node:crypto'
import { init } from '@instantdb/admin'

const APP_ID = process.env.VITE_INSTANT_APP_ID
const TOKEN  = process.env.INSTANTDB_ADMIN_TOKEN
const PEPPER = process.env.VAULT_PIN_PEPPER || TOKEN || 'wwi-vault-pepper'

const MAX_ATTEMPTS = 5
const LOCK_MS      = 5 * 60 * 1000   // lock verification for 5 min after MAX_ATTEMPTS

function hashPin(pin, memorialId) {
  return crypto.createHash('sha256').update(`${pin}:${memorialId}:${PEPPER}`).digest('hex')
}

export default async function handler(req, res) {
  if (req.method !== 'POST')  return res.status(405).json({ error: 'Method not allowed' })
  if (!APP_ID || !TOKEN)      return res.status(500).json({ error: 'Vault service is not configured' })

  const { action, memorialId, pin, userId, currentPin } = req.body || {}
  if (!memorialId)                          return res.status(400).json({ error: 'Missing memorialId' })
  if (!/^\d{6}$/.test(String(pin || '')))   return res.status(400).json({ error: 'PIN must be 6 digits' })

  const db = init({ appId: APP_ID, adminToken: TOKEN })

  try {
    const data     = await db.query({ memorials: { $: { where: { id: memorialId } } } })
    const memorial = data?.memorials?.[0]
    if (!memorial) return res.status(404).json({ error: 'Memorial not found' })

    // ── Set / change / reset the shared PIN ───────────────────────────────────
    if (action === 'set') {
      const isCreator = !memorial.creatorId || memorial.creatorId === userId
      if (memorial.vaultPinHash) {
        // An existing PIN can be changed by proving the current PIN, or by the
        // memorial owner (covers the email-verified reset flow).
        const knowsCurrent = hashPin(String(currentPin || ''), memorialId) === memorial.vaultPinHash
        if (!knowsCurrent && !isCreator) {
          return res.status(403).json({ error: 'Enter the current PIN to change it.' })
        }
      } else if (!isCreator) {
        return res.status(403).json({ error: 'Only the memorial owner can set up the vault.' })
      }

      await db.transact([
        db.tx.memorials[memorialId].update({
          vaultPinHash:        hashPin(String(pin), memorialId),
          vaultPinUpdatedAt:   Date.now(),
          vaultFailedAttempts: 0,
          vaultLockUntil:      0,
        }),
      ])
      return res.json({ ok: true })
    }

    // ── Verify a PIN (rate-limited) ───────────────────────────────────────────
    if (action === 'verify') {
      if (!memorial.vaultPinHash) return res.status(409).json({ error: 'This vault has not been set up yet.' })

      const now = Date.now()
      if (memorial.vaultLockUntil && now < memorial.vaultLockUntil) {
        return res.status(429).json({ ok: false, lockedUntil: memorial.vaultLockUntil })
      }

      if (hashPin(String(pin), memorialId) === memorial.vaultPinHash) {
        if (memorial.vaultFailedAttempts || memorial.vaultLockUntil) {
          await db.transact([ db.tx.memorials[memorialId].update({ vaultFailedAttempts: 0, vaultLockUntil: 0 }) ])
        }
        return res.json({ ok: true })
      }

      const attempts  = (memorial.vaultFailedAttempts || 0) + 1
      const lockUntil = attempts >= MAX_ATTEMPTS ? now + LOCK_MS : 0
      await db.transact([
        db.tx.memorials[memorialId].update({
          vaultFailedAttempts: lockUntil ? 0 : attempts,   // reset counter once a lock starts
          vaultLockUntil:      lockUntil,
        }),
      ])
      return res.json({
        ok: false,
        lockedUntil: lockUntil || undefined,
        attemptsLeft: lockUntil ? 0 : Math.max(0, MAX_ATTEMPTS - attempts),
      })
    }

    return res.status(400).json({ error: 'Unknown action' })
  } catch (err) {
    console.error('[vault-pin]', err)
    return res.status(500).json({ error: 'Vault operation failed. Please try again.' })
  }
}
