// src/lib/plans.js
// Single source of truth for subscription tiers and what each one unlocks.
//
//   free → premium → family
//
// Every paywall in the app reads FEATURES / LIMITS here, so the whole tier
// allocation can be re-balanced by editing this one file — the gates elsewhere
// just reference stable feature keys.

export const PLAN_IDS = ['free', 'premium', 'family']
export const CURRENCY = '£'

export const PLANS = {
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Remember & share',
    price: 0,
    period: 'forever',
    emoji: '◎',
    highlighted: false,
    cta: 'Current plan',
    features: [
      'One memorial',
      'Unlimited tributes & condolences',
      'Photo gallery — up to 8 photos',
      'One sealed Legacy Letter',
      'Cinematic Life Reel',
      'Privacy controls (public · family · private)',
    ],
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    tagline: 'Their voice, kept alive',
    price: 9,
    period: '/month',
    emoji: '✦',
    highlighted: true,
    cta: 'Upgrade to Premium',
    features: [
      'Everything in Free',
      'Unlimited memorials',
      'Voice memory capture — preserve their voice',
      'Living voice conversation — talk with their memory',
      'Unlimited photo gallery',
      'Unlimited Legacy Letters & full Vault',
      'Ad-free · priority support',
    ],
  },
  family: {
    id: 'family',
    name: 'Family',
    tagline: 'Together, as a family',
    price: 19,
    period: '/month',
    emoji: '♡',
    highlighted: false,
    cta: 'Go Family',
    features: [
      'Everything in Premium',
      'Family Circle — invite & connect relatives',
      'Shared Vault access for family',
      'Family tree across generations',
      'Multiple contributors per memorial',
      'Dedicated support',
    ],
  },
}

export const PLAN_LIST = PLAN_IDS.map((id) => PLANS[id])

// ─── Entitlements — which plans unlock each gated capability ────────────────────
// A feature absent from this map is ungated (available to everyone).
export const FEATURES = {
  unlimitedMemorials: ['premium', 'family'],
  voiceCapture:       ['premium', 'family'],
  voiceConversation:  ['premium', 'family'],
  unlimitedGallery:   ['premium', 'family'],
  unlimitedLetters:   ['premium', 'family'],
  familyCircle:       ['family'],
  familyTree:         ['family'],
  sharedVault:        ['family'],
}

// Copy shown in the upgrade cutoff for each gated feature.
export const FEATURE_COPY = {
  unlimitedMemorials: { title: 'Create more memorials',     body: 'The Free plan includes one memorial. Upgrade to honour everyone who matters.' },
  voiceCapture:       { title: 'Preserve their voice',      body: 'Capture and keep a loved one’s voice — a Premium feature.' },
  voiceConversation:  { title: 'Talk with their memory',    body: 'Hold a living voice conversation with their AI memory — a Premium feature.' },
  unlimitedGallery:   { title: 'Add more photos',           body: 'Free galleries hold up to 8 photos. Upgrade for an unlimited gallery.' },
  unlimitedLetters:   { title: 'Write more Legacy Letters', body: 'Free includes one sealed letter. Upgrade for unlimited time-sealed letters.' },
  familyCircle:       { title: 'Invite your family',        body: 'Connect relatives and share access — part of the Family plan.' },
  familyTree:         { title: 'Build your family tree',    body: 'Map your family across generations — part of the Family plan.' },
  sharedVault:        { title: 'Share the Vault',           body: 'Give trusted family members access to the Legacy Vault — part of the Family plan.' },
}

// ─── Numeric limits per plan ────────────────────────────────────────────────────
const INF = Infinity
export const LIMITS = {
  memorials:         { free: 1, premium: INF, family: INF },
  photosPerMemorial: { free: 8, premium: INF, family: INF },
  letters:           { free: 1, premium: INF, family: INF },
}

// Normalise any stored value to a current tier (older 'legacy' → 'family').
export function normalizePlan(plan) {
  if (plan === 'legacy') return 'family'
  return PLAN_IDS.includes(plan) ? plan : 'free'
}

export function planRank(plan) {
  return PLAN_IDS.indexOf(normalizePlan(plan))
}

export function hasFeature(plan, feature) {
  const allowed = FEATURES[feature]
  if (!allowed) return true // ungated
  return allowed.includes(normalizePlan(plan))
}

// Lowest tier that unlocks a feature — used for "upgrade to X" messaging.
export function requiredPlanFor(feature) {
  const allowed = FEATURES[feature] || []
  return PLAN_IDS.find((id) => allowed.includes(id)) || 'premium'
}

export function planLimit(plan, key) {
  const row = LIMITS[key]
  if (!row) return INF
  return row[normalizePlan(plan)] ?? INF
}

export function planMeta(plan) {
  return PLANS[normalizePlan(plan)]
}
