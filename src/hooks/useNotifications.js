// src/hooks/useNotifications.js
// Real-time notification system built on top of InstantDB's live query.
// No extra collection needed — derives "new" tributes by comparing against
// a locally-stored "last seen" timestamp per user.
//
// Usage:
//   const { count, notifications, markAllSeen } = useNotifications(user)

import { useState, useEffect } from 'react'
import { db } from '../lib/instant'

const STORAGE_KEY = uid => `whowasi_notif_seen_${uid}`

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

  // Live query: user's memorials + recent tributes on each
  const { data } = db.useQuery(
    user
      ? {
          memorials: {
            $: { where: { creatorId: user.id }, limit: 20 },
            tributes: { $: { limit: 30 } },
          },
        }
      : null
  )

  const memorials = data?.memorials || []

  // Flatten tributes, exclude ones the owner posted themselves
  const allTributes = memorials.flatMap(m =>
    (m.tributes || []).map(t => ({
      ...t,
      memorialName: m.name,
      memorialId:   m.id,
    }))
  )

  // "New" = arrived after last seen + not from the owner themselves
  const newTributes = allTributes.filter(
    t => (t.createdAt || 0) > lastSeen && t.authorId !== user?.id
  )

  // Sort newest first
  const notifications = [...newTributes].sort(
    (a, b) => (b.createdAt || 0) - (a.createdAt || 0)
  )

  function markAllSeen() {
    const now = Date.now()
    if (user?.id) localStorage.setItem(STORAGE_KEY(user.id), String(now))
    setLastSeen(now)
  }

  return {
    count:         notifications.length,
    notifications, // array of tribute objects enriched with memorialName/memorialId
    markAllSeen,
    hasNew:        notifications.length > 0,
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
