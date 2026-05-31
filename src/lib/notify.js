// src/lib/notify.js
// Creates a persistent notification row for a recipient. Backs the bell feed
// (useNotifications) so likes / comments / family activity reach the receiver
// and are saved to their account (not just a transient toast).
//
// No-ops safely when there's no recipient, or when the actor is the recipient
// (you don't get notified about your own action).

import { id } from '@instantdb/react'
import { db } from './instant'

export async function notify({
  recipientId,
  type,
  actorId,
  actorName,
  actorPhoto,
  memorialId,
  memorialName,
  tributeId,
  preview,
  link,
}) {
  if (!recipientId) return                 // nobody to notify (e.g. guest tribute)
  if (actorId && actorId === recipientId) return  // don't notify yourself

  try {
    await db.transact([
      db.tx.notifications[id()].update({
        recipientId,
        type,
        actorName: actorName || 'Someone',
        seen: false,
        createdAt: Date.now(),
        ...(actorId      ? { actorId } : {}),
        ...(actorPhoto   ? { actorPhoto } : {}),
        ...(memorialId   ? { memorialId } : {}),
        ...(memorialName ? { memorialName } : {}),
        ...(tributeId    ? { tributeId } : {}),
        ...(preview      ? { preview: String(preview).slice(0, 140) } : {}),
        ...(link         ? { link } : {}),
      }),
    ])
  } catch (e) {
    // Notifications are best-effort — never block the underlying action.
    console.warn('[notify] failed:', e?.message || e)
  }
}
