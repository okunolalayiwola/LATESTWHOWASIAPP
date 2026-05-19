// src/lib/relations.js
// Structured relation system used by RelationPicker, CreateMemorialPage,
// ExplorePage filters, and FamilyTreePage auto-placement.
//
// Three responsibilities:
//   1. RELATION_GROUPS — canonical structure (60+ relations, 9 groups, ring mapping)
//   2. RELATION_ALIASES — alias + misspelling map → canonical value
//   3. normalizeRelation() — turns free text into a canonical value or returns null

// ─── Canonical relation groups ────────────────────────────────────────────────

export const RELATION_GROUPS = [
  {
    group: 'Partner',
    ring: 1,
    icon: '💍',
    filterCategory: 'partner',
    relations: [
      { value: 'husband',          label: 'Husband',                short: 'Husband',       byMarriage: false },
      { value: 'wife',             label: 'Wife',                   short: 'Wife',          byMarriage: false },
      { value: 'partner',          label: 'Partner',                short: 'Partner',       byMarriage: false },
      { value: 'ex_husband',       label: 'Ex-Husband',             short: 'Ex-Husband',    byMarriage: false },
      { value: 'ex_wife',          label: 'Ex-Wife',                short: 'Ex-Wife',       byMarriage: false },
      { value: 'fiancee',          label: 'Fiancé / Fiancée',       short: 'Fiancé',        byMarriage: false },
    ],
  },
  {
    group: 'Children',
    ring: 1,
    icon: '🌱',
    filterCategory: 'children',
    relations: [
      { value: 'son',              label: 'Son',                    short: 'Son',           byMarriage: false },
      { value: 'daughter',         label: 'Daughter',               short: 'Daughter',      byMarriage: false },
      { value: 'stepson',          label: 'Stepson',                short: 'Stepson',       byMarriage: true  },
      { value: 'stepdaughter',     label: 'Stepdaughter',           short: 'Stepdaughter',  byMarriage: true  },
      { value: 'adopted_son',      label: 'Adopted Son',            short: 'Adopted Son',   byMarriage: false },
      { value: 'adopted_daughter', label: 'Adopted Daughter',       short: 'Adopted Dau.',  byMarriage: false },
      { value: 'son_in_law',       label: 'Son-in-law',             short: 'Son-in-law',    byMarriage: true  },
      { value: 'daughter_in_law',  label: 'Daughter-in-law',        short: 'Dau.-in-law',   byMarriage: true  },
    ],
  },
  {
    group: 'Siblings',
    ring: 1,
    icon: '🤝',
    filterCategory: 'siblings',
    relations: [
      { value: 'brother',          label: 'Brother',                short: 'Brother',       byMarriage: false },
      { value: 'sister',           label: 'Sister',                 short: 'Sister',        byMarriage: false },
      { value: 'half_brother',     label: 'Half-brother',           short: 'Half-Bro.',     byMarriage: false },
      { value: 'half_sister',      label: 'Half-sister',            short: 'Half-Sis.',     byMarriage: false },
      { value: 'stepbrother',      label: 'Stepbrother',            short: 'Stepbro.',      byMarriage: true  },
      { value: 'stepsister',       label: 'Stepsister',             short: 'Stepsis.',      byMarriage: true  },
      { value: 'brother_in_law',   label: 'Brother-in-law',         short: 'Bro.-in-law',   byMarriage: true  },
      { value: 'sister_in_law',    label: 'Sister-in-law',          short: 'Sis.-in-law',   byMarriage: true  },
    ],
  },
  {
    group: 'Parents',
    ring: 2,
    icon: '🌳',
    filterCategory: 'parents',
    relations: [
      { value: 'father',           label: 'Father',                 short: 'Father',        byMarriage: false },
      { value: 'mother',           label: 'Mother',                 short: 'Mother',        byMarriage: false },
      { value: 'stepfather',       label: 'Stepfather',             short: 'Stepfather',    byMarriage: true  },
      { value: 'stepmother',       label: 'Stepmother',             short: 'Stepmother',    byMarriage: true  },
      { value: 'father_in_law',    label: 'Father-in-law',          short: 'Father-in-law', byMarriage: true  },
      { value: 'mother_in_law',    label: 'Mother-in-law',          short: 'Mother-in-law', byMarriage: true  },
      { value: 'foster_father',    label: 'Foster Father',          short: 'Foster Father', byMarriage: false },
      { value: 'foster_mother',    label: 'Foster Mother',          short: 'Foster Mother', byMarriage: false },
    ],
  },
  {
    group: 'Extended',
    ring: 2,
    icon: '🌿',
    filterCategory: 'extended',
    relations: [
      { value: 'uncle',            label: 'Uncle',                  short: 'Uncle',         byMarriage: false },
      { value: 'aunt',             label: 'Aunt',                   short: 'Aunt',          byMarriage: false },
      { value: 'cousin',           label: 'Cousin',                 short: 'Cousin',        byMarriage: false },
      { value: 'nephew',           label: 'Nephew',                 short: 'Nephew',        byMarriage: false },
      { value: 'niece',            label: 'Niece',                  short: 'Niece',         byMarriage: false },
    ],
  },
  {
    group: 'Grandparents',
    ring: 3,
    icon: '🏛',
    filterCategory: 'grandparents',
    relations: [
      { value: 'grandfather',               label: 'Grandfather',             short: 'Grandfather', byMarriage: false },
      { value: 'grandmother',               label: 'Grandmother',             short: 'Grandmother', byMarriage: false },
      { value: 'paternal_grandfather',      label: 'Grandfather (Paternal)',  short: 'Grandad P.',  byMarriage: false },
      { value: 'paternal_grandmother',      label: 'Grandmother (Paternal)',  short: 'Grandma P.',  byMarriage: false },
      { value: 'maternal_grandfather',      label: 'Grandfather (Maternal)',  short: 'Grandad M.',  byMarriage: false },
      { value: 'maternal_grandmother',      label: 'Grandmother (Maternal)',  short: 'Grandma M.',  byMarriage: false },
      { value: 'grandfather_in_law',        label: 'Grandfather-in-law',      short: 'Grandad-IL',  byMarriage: true  },
      { value: 'grandmother_in_law',        label: 'Grandmother-in-law',      short: 'Grandma-IL',  byMarriage: true  },
    ],
  },
  {
    group: 'Ancestors',
    ring: 3,
    icon: '📜',
    filterCategory: 'grandparents',   // rolls up into grandparents filter
    relations: [
      { value: 'great_grandfather',         label: 'Great-grandfather',       short: 'Gt. Grandad', byMarriage: false },
      { value: 'great_grandmother',         label: 'Great-grandmother',       short: 'Gt. Grandma', byMarriage: false },
      { value: 'great_great_grandfather',   label: 'Great-great-grandfather', short: 'G.Gt. Grandad', byMarriage: false },
      { value: 'great_great_grandmother',   label: 'Great-great-grandmother', short: 'G.Gt. Grandma', byMarriage: false },
    ],
  },
  {
    group: 'Godparents',
    ring: 3,
    icon: '✦',
    filterCategory: 'friends',
    relations: [
      { value: 'godfather',        label: 'Godfather',              short: 'Godfather',     byMarriage: false },
      { value: 'godmother',        label: 'Godmother',              short: 'Godmother',     byMarriage: false },
      { value: 'godchild',         label: 'Godchild',               short: 'Godchild',      byMarriage: false },
      { value: 'mentor',           label: 'Mentor / Elder',         short: 'Mentor',        byMarriage: false },
      { value: 'family_friend',    label: 'Close Family Friend',    short: 'Family Friend', byMarriage: false },
    ],
  },
  {
    group: 'Other',
    ring: 3,
    icon: '◎',
    filterCategory: 'friends',
    relations: [
      { value: 'other',            label: 'Other',                  short: 'Other',         byMarriage: false },
    ],
  },
]

// ─── Filter category mapping ───────────────────────────────────────────────────
// Maps the ExplorePage filter tab IDs to which groups they include.

export const FILTER_CATEGORY_MAP = {
  'all':          null,   // show everything
  'parents':      ['Parents'],
  'grandparents': ['Grandparents', 'Ancestors'],
  'siblings':     ['Siblings'],
  'children':     ['Children'],
  'partner':      ['Partner'],
  'extended':     ['Extended'],
  'friends':      ['Godparents', 'Other'],
}

// ─── Alias map ────────────────────────────────────────────────────────────────
// Maps every common spelling, nickname, abbreviation, and misspelling
// to a canonical relation value.

const ALIASES = {
  // ── Mother ────────────────────────────────────────────────────────────────
  'mother': 'mother', 'mum': 'mother', 'mom': 'mother', 'mummy': 'mother',
  'mama': 'mother', 'mommy': 'mother', 'ma': 'mother',
  'my mother': 'mother', 'my mum': 'mother', 'my mom': 'mother',
  'biological mother': 'mother', 'birth mother': 'mother',

  // ── Father ────────────────────────────────────────────────────────────────
  'father': 'father', 'dad': 'father', 'daddy': 'father', 'papa': 'father',
  'pa': 'father', 'pop': 'father', 'pops': 'father', 'dada': 'father',
  'my father': 'father', 'my dad': 'father',
  'biological father': 'father', 'birth father': 'father',

  // ── Grandmother ───────────────────────────────────────────────────────────
  'grandmother': 'grandmother', 'grandma': 'grandmother', 'gran': 'grandmother',
  'granny': 'grandmother', 'nana': 'grandmother', 'nan': 'grandmother',
  'nanny': 'grandmother', 'grandmum': 'grandmother', 'grandmom': 'grandmother',
  'my grandmother': 'grandmother', 'my gran': 'grandmother', 'my nana': 'grandmother',
  'grand mother': 'grandmother', 'grammy': 'grandmother', 'gram': 'grandmother',

  // ── Grandfather ───────────────────────────────────────────────────────────
  'grandfather': 'grandfather', 'grandpa': 'grandfather', 'granddad': 'grandfather',
  'grandad': 'grandfather', 'gramps': 'grandfather', 'grandpapa': 'grandfather',
  'my grandfather': 'grandfather', 'my grandad': 'grandfather', 'my grandpa': 'grandfather',
  'grand father': 'grandfather', 'granddaddy': 'grandfather',

  // ── Great-grandparents ────────────────────────────────────────────────────
  'great grandmother': 'great_grandmother', 'great grandma': 'great_grandmother',
  'great-grandmother': 'great_grandmother', 'great gran': 'great_grandmother',
  'great nana': 'great_grandmother', 'gg': 'great_grandmother',
  'great grandfather': 'great_grandfather', 'great grandpa': 'great_grandfather',
  'great-grandfather': 'great_grandfather', 'great grandad': 'great_grandfather',

  // ── Siblings ──────────────────────────────────────────────────────────────
  'brother': 'brother', 'bro': 'brother', 'my brother': 'brother',
  'big brother': 'brother', 'little brother': 'brother', 'older brother': 'brother',
  'sister': 'sister', 'sis': 'sister', 'my sister': 'sister',
  'big sister': 'sister', 'little sister': 'sister', 'older sister': 'sister',

  // ── Partner ───────────────────────────────────────────────────────────────
  'husband': 'husband', 'hubby': 'husband', 'my husband': 'husband',
  'wife': 'wife', 'missus': 'wife', 'misses': 'wife', 'mrs': 'wife', 'my wife': 'wife',
  'partner': 'partner', 'my partner': 'partner', 'other half': 'partner',
  'life partner': 'partner', 'significant other': 'partner',
  'fiancee': 'fiancee', 'fiancé': 'fiancee', 'fiancée': 'fiancee',
  'fiance': 'fiancee', 'my fiance': 'fiancee', 'betrothed': 'fiancee',

  // ── Children ──────────────────────────────────────────────────────────────
  'son': 'son', 'my son': 'son', 'boy': 'son',
  'daughter': 'daughter', 'my daughter': 'daughter', 'girl': 'daughter',
  'child': 'son',  // generic → default to son
  'stepson': 'stepson', 'step son': 'stepson', 'step-son': 'stepson',
  'stepdaughter': 'stepdaughter', 'step daughter': 'stepdaughter', 'step-daughter': 'stepdaughter',

  // ── In-laws ───────────────────────────────────────────────────────────────
  'father in law': 'father_in_law', 'father-in-law': 'father_in_law', 'fil': 'father_in_law',
  'mother in law': 'mother_in_law', 'mother-in-law': 'mother_in_law', 'mil': 'mother_in_law',
  'son in law': 'son_in_law', 'son-in-law': 'son_in_law',
  'daughter in law': 'daughter_in_law', 'daughter-in-law': 'daughter_in_law',
  'brother in law': 'brother_in_law', 'brother-in-law': 'brother_in_law', 'bil': 'brother_in_law',
  'sister in law': 'sister_in_law', 'sister-in-law': 'sister_in_law', 'sil': 'sister_in_law',
  'grandfather in law': 'grandfather_in_law', 'grandmother in law': 'grandmother_in_law',

  // ── Extended ──────────────────────────────────────────────────────────────
  'uncle': 'uncle', 'my uncle': 'uncle', 'unc': 'uncle',
  'aunt': 'aunt', 'auntie': 'aunt', 'aunty': 'aunt', 'my aunt': 'aunt',
  'cousin': 'cousin', 'cuz': 'cousin', 'cous': 'cousin', 'my cousin': 'cousin',
  'nephew': 'nephew', 'my nephew': 'nephew',
  'niece': 'niece', 'my niece': 'niece',

  // ── Godparents ────────────────────────────────────────────────────────────
  'godfather': 'godfather', 'god father': 'godfather',
  'godmother': 'godmother', 'god mother': 'godmother',
  'godchild': 'godchild', 'godson': 'godchild', 'goddaughter': 'godchild',
  'mentor': 'mentor', 'elder': 'mentor',
  'friend': 'family_friend', 'family friend': 'family_friend',
  'close friend': 'family_friend', 'best friend': 'family_friend',

  // ── Stepparents ───────────────────────────────────────────────────────────
  'stepfather': 'stepfather', 'step father': 'stepfather', 'step-father': 'stepfather',
  'stepdad': 'stepfather', 'step dad': 'stepfather',
  'stepmother': 'stepmother', 'step mother': 'stepmother', 'step-mother': 'stepmother',
  'stepmum': 'stepmother', 'step mum': 'stepmother', 'stepmom': 'stepmother',
}

// ─── Levenshtein distance for fuzzy misspelling matching ──────────────────────

function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  )
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1]
        : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
    }
  }
  return dp[m][n]
}

// All canonical labels for fuzzy matching
const ALL_LABELS = RELATION_GROUPS.flatMap(g =>
  g.relations.map(r => ({ value: r.value, label: r.label.toLowerCase(), group: g.group }))
)
const ALL_ALIASES = Object.keys(ALIASES)

// ─── normalizeRelation ────────────────────────────────────────────────────────
// Takes a free-text string and returns:
//   { value, label, group, ring, confidence, suggestion } | null
//
// Confidence: 'exact' | 'alias' | 'fuzzy' | null (no match)
// If confidence === 'fuzzy', a suggestion is returned for the UI to show.

export function normalizeRelation(raw) {
  if (!raw) return null
  const input = raw.trim().toLowerCase()
  if (!input) return null

  // 1. Check if it's already a canonical value
  const direct = RELATION_GROUPS.flatMap(g => g.relations).find(r => r.value === input)
  if (direct) {
    const group = RELATION_GROUPS.find(g => g.relations.some(r => r.value === input))
    return { value: direct.value, label: direct.label, group: group.group, ring: group.ring, confidence: 'exact' }
  }

  // 2. Exact alias match
  if (ALIASES[input]) {
    const val   = ALIASES[input]
    const rel   = RELATION_GROUPS.flatMap(g => g.relations).find(r => r.value === val)
    const group = RELATION_GROUPS.find(g => g.relations.some(r => r.value === val))
    if (rel) return { value: val, label: rel.label, group: group.group, ring: group.ring, confidence: 'alias' }
  }

  // 3. Partial alias match (alias starts with input or vice versa)
  const partialAlias = ALL_ALIASES.find(alias =>
    alias.startsWith(input) || input.startsWith(alias)
  )
  if (partialAlias) {
    const val   = ALIASES[partialAlias]
    const rel   = RELATION_GROUPS.flatMap(g => g.relations).find(r => r.value === val)
    const group = RELATION_GROUPS.find(g => g.relations.some(r => r.value === val))
    if (rel) return { value: val, label: rel.label, group: group.group, ring: group.ring, confidence: 'alias', suggestion: rel.label }
  }

  // 4. Fuzzy match — find the closest canonical label or alias (Levenshtein ≤ 2)
  let bestMatch = null
  let bestDist  = Infinity

  for (const { value, label, group } of ALL_LABELS) {
    const dist = levenshtein(input, label)
    if (dist < bestDist && dist <= 2) {
      bestDist  = dist
      bestMatch = { value, label, groupName: group }
    }
  }

  if (bestMatch) {
    const group = RELATION_GROUPS.find(g => g.group === bestMatch.groupName)
    const rel   = group?.relations.find(r => r.value === bestMatch.value)
    return {
      value:      bestMatch.value,
      label:      rel?.label || bestMatch.label,
      group:      bestMatch.groupName,
      ring:       group?.ring || 3,
      confidence: 'fuzzy',
      suggestion: rel?.label || bestMatch.label,
    }
  }

  return null  // no match
}

// ─── Lookup helpers ───────────────────────────────────────────────────────────

export function getRelationRing(value) {
  if (!value) return 3
  for (const g of RELATION_GROUPS) {
    if (g.relations.some(r => r.value === value)) return g.ring
  }
  return 3
}

export function getRelationLabel(value) {
  if (!value) return ''
  for (const g of RELATION_GROUPS) {
    const r = g.relations.find(r => r.value === value)
    if (r) return r.label
  }
  // If stored as a free-text label (legacy data), try normalizing
  const normalized = normalizeRelation(value)
  return normalized?.label || value
}

export function getRelationShort(value) {
  if (!value) return ''
  for (const g of RELATION_GROUPS) {
    const r = g.relations.find(r => r.value === value)
    if (r) return r.short
  }
  return value
}

export function getRelationByMarriage(value) {
  if (!value) return false
  for (const g of RELATION_GROUPS) {
    const r = g.relations.find(r => r.value === value)
    if (r) return r.byMarriage
  }
  return false
}

export function getRelationInfo(value) {
  for (const g of RELATION_GROUPS) {
    const r = g.relations.find(r => r.value === value)
    if (r) return { ...r, ring: g.ring, group: g.group, filterCategory: g.filterCategory }
  }
  // Legacy free-text: try to normalize
  const norm = normalizeRelation(value)
  if (norm) {
    return getRelationInfo(norm.value)
  }
  return { value, label: value, short: value, ring: 3, byMarriage: false, group: 'Other', filterCategory: 'friends' }
}

export function getRelationFilterCategory(value) {
  const info = getRelationInfo(value)
  return info?.filterCategory || 'friends'
}

export function getAutoAngle(ring, existingMembersInRing = []) {
  const count = existingMembersInRing.length
  if (count === 0) return 0
  const step = 360 / (count + 1)
  return step * count
}

// ─── Validation ───────────────────────────────────────────────────────────────

export function validateRelation(value) {
  if (!value || value.trim() === '') {
    return { valid: false, error: 'Please select or enter how this person is related to you.' }
  }

  // Check if it's a canonical value
  const isCanonical = RELATION_GROUPS.flatMap(g => g.relations).some(r => r.value === value)
  if (isCanonical) return { valid: true }

  // Try to normalize
  const norm = normalizeRelation(value)
  if (!norm) {
    return {
      valid: false,
      error: `"${value}" isn't a recognised relation. Please use the picker to select one.`,
    }
  }
  if (norm.confidence === 'fuzzy') {
    return {
      valid: false,
      error: null,
      suggestion: norm.label,
      suggestedValue: norm.value,
      warning: `Did you mean "${norm.label}"?`,
    }
  }

  return { valid: true }
}
