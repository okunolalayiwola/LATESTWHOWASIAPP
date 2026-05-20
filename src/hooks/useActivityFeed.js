// src/hooks/useActivityFeed.js
// Unified activity feed for the Dashboard — merges tributes, candles, memories,
// family member joins, vault letters, and upcoming birthdays/anniversaries into
// a single sorted feed with past and upcoming buckets.
//
// Usage:
//   const feed = useActivityFeed({ memorials, familyMembers, invites, letters, activities, daysAhead: 45 })

import { useMemo } from 'react'

export function useActivityFeed({
  memorials = [],
  familyMembers = [],
  invites = [],
  letters = [],
  activities = [],
  daysAhead = 45,
} = {}) {
  return useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const past = []
    const upcoming = []

    // ─── Helper: next occurrence of a month/day ──────────────────────────────
    function nextOccurrence(dateStr) {
      if (!dateStr) return null
      const d = new Date(dateStr)
      if (isNaN(d)) return null
      const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate())
      const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate())
      const daysUntil = Math.ceil((thisYear - today) / 86400000)
      return {
        date: daysUntil >= 0 ? thisYear : nextYear,
        daysUntil: daysUntil >= 0 ? daysUntil : Math.ceil((nextYear - today) / 86400000),
      }
    }

    // ─── Tributes from memorials ─────────────────────────────────────────────
    memorials.forEach(mem => {
      ;(mem.tributes || []).forEach(t => {
        const ts = t.createdAt || Date.now()
        const d = new Date(ts)
        const isPast = d < today
        const ev = {
          id:          `tribute-${t.id}`,
          kind:        'tribute',
          bucket:      isPast ? 'past' : 'upcoming',
          title:       `${t.type === 'candle' ? '🕯️' : t.type === 'memory' ? '📖' : '💐'} ${t.type === 'candle' ? 'Candle lit' : t.type === 'memory' ? 'Memory shared' : 'Tribute left'} for ${mem.name}`,
          actor:       t.authorName || 'Someone',
          context:     mem.name,
          quote:       t.message || t.text || '',
          date:        d.toISOString(),
          tone:        t.type === 'candle' ? 'butter' : t.type === 'memory' ? 'lavender' : 'mint',
          icon:        t.type === 'candle' ? 'candle' : t.type === 'memory' ? 'memory' : 'heart',
          memorialId:  mem.id,
          route:       `/memorial/${mem.id}`,
        }
        if (isPast) past.push(ev)
        else upcoming.push(ev)
      })
    })

    // ─── Family member joined events ─────────────────────────────────────────
    familyMembers.forEach(m => {
      if (m.joinedAt) {
        const d = new Date(m.joinedAt)
        const isPast = d < today
        const ev = {
          id:         `member-${m.id}`,
          kind:       'member_joined',
          bucket:     isPast ? 'past' : 'upcoming',
          title:      `👤 ${m.name} joined the family tree`,
          actor:      m.name,
          context:    m.relation || 'Family member',
          date:       d.toISOString(),
          tone:       'sage',
          icon:       'user',
          route:      '/family',
        }
        if (isPast) past.push(ev)
        else upcoming.push(ev)
      }
    })

    // ─── Invites sent ────────────────────────────────────────────────────────
    invites.forEach(inv => {
      if (inv.createdAt) {
        const d = new Date(inv.createdAt)
        const isPast = d < today
        const ev = {
          id:         `invite-${inv.id}`,
          kind:       'invite',
          bucket:     isPast ? 'past' : 'upcoming',
          title:      `✉️ Invite sent to ${inv.email || 'a family member'}`,
          actor:      'You',
          context:    inv.role || 'Family member',
          date:       d.toISOString(),
          tone:       'sky',
          icon:       'mail',
          route:      '/family',
        }
        if (isPast) past.push(ev)
        else upcoming.push(ev)
      }
    })

    // ─── Vault letters ───────────────────────────────────────────────────────
    letters.forEach(l => {
      if (l.createdAt) {
        const d = new Date(l.createdAt)
        const isPast = d < today
        const ev = {
          id:         `letter-${l.id}`,
          kind:       'vault',
          bucket:     isPast ? 'past' : 'upcoming',
          title:      `🔒 Legacy letter saved to vault`,
          actor:      'You',
          context:    l.title || 'Untitled letter',
          date:       d.toISOString(),
          tone:       'ink',
          icon:       'lock',
          route:      '/vault',
        }
        if (isPast) past.push(ev)
        else upcoming.push(ev)
      }
    })

    // ─── Upcoming birthdays & anniversaries ──────────────────────────────────
    familyMembers.forEach(m => {
      // Birthday
      if (m.born) {
        const occ = nextOccurrence(m.born)
        if (occ && occ.daysUntil <= daysAhead) {
          upcoming.push({
            id:         `bday-${m.id}`,
            kind:       'birthday',
            bucket:     'upcoming',
            title:      `✿ ${m.name}'s Birthday`,
            actor:      m.name,
            context:    `${occ.daysUntil === 0 ? 'Today!' : `In ${occ.daysUntil} days`}`,
            date:       occ.date.toISOString(),
            when:       occ.daysUntil === 0 ? 'Today' : occ.daysUntil === 1 ? 'Tomorrow' : `In ${occ.daysUntil} days`,
            tone:       'butter',
            icon:       'calendar',
            route:      '/family',
          })
        }
      }

      // Death anniversary
      if (!m.alive && m.died) {
        const occ = nextOccurrence(m.died)
        if (occ && occ.daysUntil <= daysAhead) {
          upcoming.push({
            id:         `ann-${m.id}`,
            kind:       'anniversary',
            bucket:     'upcoming',
            title:      `✦ ${m.name}'s Anniversary`,
            actor:      m.name,
            context:    `${occ.daysUntil === 0 ? 'Today' : `In ${occ.daysUntil} days`}`,
            date:       occ.date.toISOString(),
            when:       occ.daysUntil === 0 ? 'Today' : occ.daysUntil === 1 ? 'Tomorrow' : `In ${occ.daysUntil} days`,
            tone:       'lavender',
            icon:       'clock',
            route:      '/family',
          })
        }
      }
    })

    // ─── Memorial death anniversaries ────────────────────────────────────────
    memorials.forEach(mem => {
      const deathDate = mem.deathYear || mem.died
      if (deathDate) {
        const occ = nextOccurrence(deathDate)
        if (occ && occ.daysUntil <= daysAhead) {
          upcoming.push({
            id:         `mem-ann-${mem.id}`,
            kind:       'memorial_anniversary',
            bucket:     'upcoming',
            title:      `☽ ${mem.name}'s Memorial Day`,
            actor:      mem.name,
            context:    `${occ.daysUntil === 0 ? 'Today' : `In ${occ.daysUntil} days`}`,
            date:       occ.date.toISOString(),
            when:       occ.daysUntil === 0 ? 'Today' : occ.daysUntil === 1 ? 'Tomorrow' : `In ${occ.daysUntil} days`,
            tone:       'peach',
            icon:       'clock',
            memorialId: mem.id,
            route:      `/memorial/${mem.id}`,
          })
        }
      }
    })

    // ─── Sort: past newest-first, upcoming soonest-first ─────────────────────
    past.sort((a, b) => new Date(b.date) - new Date(a.date))
    upcoming.sort((a, b) => new Date(a.date) - new Date(b.date))

    return {
      past,
      upcoming,
      counts: {
        activity: past.length,
        upcoming: upcoming.length,
      },
    }
  }, [memorials, familyMembers, invites, letters, activities, daysAhead])
}
