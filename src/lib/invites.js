// src/lib/invites.js
// The missing redemption layer. Both the onboarding code box and the
// /family-tree?invite=CODE link route through redeemInvite().
//
// Model: an invite ties a NEW user to the FAMILY OWNER who generated it.
// "Joining a family" = the joiner's profile records familyOwnerId, so the
// app can show the shared family tree / archive of that owner.

import { id } from '@instantdb/react'
import { db } from './instant'

/**
 * Validate + redeem an invite code for the signed-in user.
 * @returns {Promise<{ok:boolean, reason?:string, familyOwnerId?:string}>}
 */
export async function redeemInvite(code, user) {
  if (!code || !user) return { ok: false, reason: 'Missing code or user.' }

  const clean = String(code).trim().toUpperCase()
  if (clean.length < 6) return { ok: false, reason: 'That code looks too short.' }

  // 1. Look the code up
  let invite
  try {
    const { data } = await db.queryOnce({
      invites: { $: { where: { code: clean } } },
    })
    invite = data?.invites?.[0]
  } catch {
    return { ok: false, reason: 'Could not check the code. Try again.' }
  }

  if (!invite)                       return { ok: false, reason: 'Invite code not found.' }
  if (invite.used)                   return { ok: false, reason: 'This invite has already been used.' }
  if (invite.expiresAt && invite.expiresAt < Date.now())
                                     return { ok: false, reason: 'This invite has expired.' }
  if (invite.familyOwnerId === user.id)
                                     return { ok: false, reason: "That's your own invite code." }

  // 2. Link the joiner's profile to the family owner + mark invite used
  try {
    const { data } = await db.queryOnce({
      profiles: { $: { where: { userId: user.id } } },
    })
    const profile   = data?.profiles?.[0]
    const profileId  = profile?.id || id()

    await db.transact([
      db.tx.profiles[profileId].update({
        userId:        user.id,
        familyOwnerId: invite.familyOwnerId,   // ← the actual join
        joinedFamilyAt: Date.now(),
      }),
      db.tx.invites[invite.id].update({
        used:   true,
        usedBy: user.id,
        usedAt: Date.now(),
      }),
    ])

    return { ok: true, familyOwnerId: invite.familyOwnerId }
  } catch {
    return { ok: false, reason: 'Could not join the family. Try again.' }
  }
}
