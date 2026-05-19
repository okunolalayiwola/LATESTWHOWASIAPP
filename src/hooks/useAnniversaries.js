// src/hooks/useAnniversaries.js
// Detects upcoming birthdays and death anniversaries from family members
// and memorials. Returns events sorted by days until they occur.
//
// Usage:
//   const events = useAnniversaries({ members, memorials, daysAhead: 30 })

export function useAnniversaries({ members = [], memorials = [], daysAhead = 30 } = {}) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const events = []

  // ─── Helper: next occurrence of a month/day from a year ────────────────────
  function nextOccurrence(year) {
    if (!year) return null

    // Support both ISO string ("1942-03-15") and plain year number (1942)
    const date = typeof year === 'string' && year.includes('-')
      ? new Date(year)
      : new Date(`${year}-01-01`)

    if (isNaN(date)) return null

    const thisYear = new Date(today.getFullYear(), date.getMonth(), date.getDate())
    const nextYear = new Date(today.getFullYear() + 1, date.getMonth(), date.getDate())

    // daysUntil can be 0 (today) or negative (already passed this year)
    const daysUntil = Math.ceil((thisYear - today) / 86400000)
    return {
      date:     daysUntil >= 0 ? thisYear : nextYear,
      daysUntil: daysUntil >= 0 ? daysUntil : Math.ceil((nextYear - today) / 86400000),
      originalYear: typeof year === 'number' ? year : date.getFullYear(),
    }
  }

  // ─── Family members ─────────────────────────────────────────────────────────
  members.forEach(m => {
    // Birthday
    if (m.born) {
      const occ = nextOccurrence(m.born)
      if (occ && occ.daysUntil <= daysAhead) {
        events.push({
          id:        `bday-${m.id}`,
          type:      'birthday',
          label:     'Birthday',
          emoji:     '✿',
          name:      m.name,
          relation:  m.relation,
          daysUntil: occ.daysUntil,
          date:      occ.date,
          age:       today.getFullYear() - occ.originalYear,
          memberId:  m.id,
        })
      }
    }

    // Death anniversary
    if (!m.alive && m.died) {
      const occ = nextOccurrence(m.died)
      if (occ && occ.daysUntil <= daysAhead) {
        events.push({
          id:        `ann-${m.id}`,
          type:      'anniversary',
          label:     'Anniversary',
          emoji:     '✦',
          name:      m.name,
          relation:  m.relation,
          daysUntil: occ.daysUntil,
          date:      occ.date,
          years:     today.getFullYear() - occ.originalYear,
          memberId:  m.id,
        })
      }
    }
  })

  // ─── Memorials ──────────────────────────────────────────────────────────────
  memorials.forEach(mem => {
    if (mem.deathYear || mem.died) {
      const occ = nextOccurrence(mem.deathYear || mem.died)
      if (occ && occ.daysUntil <= daysAhead) {
        events.push({
          id:         `mem-ann-${mem.id}`,
          type:       'memorial',
          label:      'Memorial Day',
          emoji:      '☽',
          name:       mem.name,
          daysUntil:  occ.daysUntil,
          date:       occ.date,
          years:      today.getFullYear() - occ.originalYear,
          memorialId: mem.id,
        })
      }
    }
  })

  return events.sort((a, b) => a.daysUntil - b.daysUntil)
}

// ─── Format helpers ───────────────────────────────────────────────────────────

export function daysUntilLabel(days) {
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  if (days <= 7)  return `In ${days} days`
  return `In ${days} days`
}

export function formatEventDate(date) {
  if (!date) return ''
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long',
  })
}
