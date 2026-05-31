// src/hooks/useNotifications.js
// Notification feed backing the bell. Two sources, merged:
//   1. Persistent `notifications` rows (likes, comments, family activity) —
//      created via src/lib/notify.js and addressed to recipientId === user.id.
//   2. Derived "new tribute" events on memorials the user owns (no row needed;
//      compared against a per-user localStorage "last seen" timestamp).
//
// Output items are normalised to { id, text, time, link, createdAt, seen } so
// the bell can render them uniformly.

import { useState, useEffect } from 'react'
import { db } from '../lib/instant'

const STORAGE_KEY = uid => `whowasi_notif_seen_${uid}`

// Build a human sentence for a persistent notification row.
function describe(n) {
  const who = n.actorName || 'Someone'
  const on  = n.memorialName ? ` on ${n.memorialName}` : ''
  switch (n.type) {
    case 'tribute_like':     return `${who} liked your tribute${on}`
    case 'tribute_comment':  return `${who} commented on a tribute${on}`
    case 'photo_comment':    return `${who} commented on a photo${on}`
    case 'family_request':   return `${who} asked to join${on || ' your family'}`
    case 'family_approved':  return `Your connection${on} was approved`
    default:                 return `${who} interacted with your memorial${on}`
  }
}

export function useNotifications(user) {
  // Persist "last seen" timestamp in localStorage so it survives page refresh
  const [lastSeen, setLastSeen] = useState(() => {
    if (!user?.id) return 0
    return parseInt(localStorage.getItem(STORAGE_KEY(user.id)) || '0', 10)
  })

  // Re-read from storage when user changes (e.g. after sign-in)
  useEffect(() => {
    if (!user?.id) return
    const stored = parseInt(localStorage.getItem(STORAGE_KEY(user.id)) || '0', 10)
    setLastSeen(stored)
  }, [user?.id])

  // Live query: persistent notifications + user's memorials & recent tributes
  const { data } = db.useQuery(
    user
      ? {
          notifications: {
            $: { where: { recipientId: user.id }, order: { serverCreatedAt: 'desc' }, limit: 40 },
          },
          memorials: {
            $: { where: { creatorId: user.id }, limit: 20 },
            tributes: { $: { limit: 30 } },
          },
        }
      : null
  )

  const rows      = data?.notifications || []
  const memorials = data?.memorials || []

  // ── Source 1: persistent rows (likes / comments / family activity) ─────────
  const rowItems = rows.map(n => ({
    id:        n.id,
    text:      describe(n),
    time:      notifTimeAgo(n.createdAt),
    link:      n.link || (n.memorialId ? `/memorial/${n.memorialId}` : null),
    createdAt: n.createdAt || 0,
    seen:      n.seen === true,
  }))

  // ── Source 2: derived new tributes on owned memorials ──────────────────────
  const tributeItems = memorials.flatMap(m =>
    (m.tributes || [])
      .filter(t => (t.createdAt || 0) > lastSeen && t.authorId !== user?.id)
      .map(t => ({
        id:        t.id,
        text:      `${t.authorName || 'Someone'} left a tribute on ${m.name}`,
        time:      notifTimeAgo(t.createdAt),
        link:      `/memorial/${m.id}`,
        createdAt: t.createdAt || 0,
        seen:      false,
      }))
  )

  // Merge, newest first
  const notifications = [...rowItems, ...tributeItems].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  )

  // Unread = unseen rows + derived tributes after lastSeen
  const unreadCount = notifications.filter(n => !n.seen).length

  async function markAllSeen() {
    const now = Date.now()
    if (user?.id) localStorage.setItem(STORAGE_KEY(user.id), String(now))
    setLastSeen(now)
    // Mark persistent rows as seen so the badge clears across devices.
    const unseen = rows.filter(n => n.seen !== true)
    if (unseen.length) {
      try {
        await db.transact(unseen.map(n => db.tx.notifications[n.id].update({ seen: true })))
      } catch {}
    }
  }

  return {
    count:         unreadCount,
    notifications, // normalised { id, text, time, link, createdAt, seen }
    markAllSeen,
    hasNew:        unreadCount > 0,
  }
}

// ─── Time formatter ─────────────────────────────────────────────────────────

export function notifTimeAgo(ts) {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m    = Math.floor(diff / 60000)
  if (m < 1)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return new Date(ts).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
