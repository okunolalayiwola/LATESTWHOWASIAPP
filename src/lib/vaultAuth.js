// src/lib/vaultAuth.js
// WHO WAS I Legacy Vault — authentication layer
//
// Two auth methods:
//   1. Biometric  — WebAuthn platform authenticator (Face ID / Fingerprint)
//   2. PIN        — 6-digit code, stored as SHA-256 hash in localStorage
//
// PIN/setup are shared across all visitors of a memorial — the vault creator
// sets the PIN once, and any visitor (family member, etc.) can open it with the
// same code. Biometrics, session, and reset codes remain per-device/per-user.

// ─── Storage keys ─────────────────────────────────────────────────────────────
// The PIN itself now lives server-side (on the memorial, verified via
// /api/email action 'vault-pin') so it is a true shared secret across devices.
// Only per-device conveniences (biometric credential, session) stay local.

const credKey  = (mid, uid) => `wwi_vault_${mid}_${uid}_cred`   // per-device biometrics
const setupKey = (mid)      => `wwi_vault_${mid}_shared_setup`  // legacy marker (biometric reg)

// ─── Generate a unique vault ID (displayed on the lock screen) ────────────────

export function getVaultId(memorialId) {
  // Deterministic short ID derived from the memorial ID
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let hash = 0
  for (let i = 0; i < memorialId.length; i++) {
    hash = ((hash << 5) - hash) + memorialId.charCodeAt(i)
    hash |= 0
  }
  let id = ''
  let n  = Math.abs(hash)
  for (let i = 0; i < 8; i++) {
    id += chars[n % chars.length]
    n  = Math.floor(n / chars.length) + i * 7
  }
  return id.slice(0, 4) + '-' + id.slice(4)
}

// ─── SHA-256 hash (used by the email-based reset code, still device-local) ─────

async function sha256(text) {
  const data   = new TextEncoder().encode(text)
  const buf    = await crypto.subtle.digest('SHA-256', data)
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('')
}

// ─── Setup state ──────────────────────────────────────────────────────────────
// Whether a vault has a PIN is now a property of the memorial record, so it is
// the same for every visitor on every device. Callers pass the memorial object.

export function isVaultSetupFor(memorial) {
  return !!memorial?.vaultPinHash
}

// ─── PIN management (server-verified shared secret) ─────────────────────────────

// PIN set/verify run server-side; folded into /api/email (action 'vault-pin')
// to stay under the Vercel Hobby-plan function limit.
const VAULT_PIN_API = '/api/email'

// Create or change the shared PIN. `currentPin` is required to change an existing
// PIN unless the caller is the memorial creator (enforced server-side). Throws on
// failure with a human-readable message.
export async function setPIN(memorialId, userId, pin, currentPin) {
  const r = await fetch(VAULT_PIN_API, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ action: 'vault-pin', sub: 'set', memorialId, userId, pin, currentPin }),
  })
  const json = await r.json().catch(() => ({}))
  if (!r.ok || !json.ok) throw new Error(json.error || 'Could not set the vault PIN.')
  return true
}

// Verify a PIN server-side. Returns { ok, lockedUntil, attemptsLeft, error }.
export async function verifyPIN(memorialId, _userId, pin) {
  try {
    const r = await fetch(VAULT_PIN_API, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ action: 'vault-pin', sub: 'verify', memorialId, pin }),
    })
    const json = await r.json().catch(() => ({}))
    return {
      ok:           !!json.ok,
      lockedUntil:  json.lockedUntil || null,
      attemptsLeft: json.attemptsLeft,
      error:        json.ok ? null : (json.error || null),
    }
  } catch {
    return { ok: false, lockedUntil: null, error: 'Network error — please try again.' }
  }
}

// ─── PIN reset via email ──────────────────────────────────────────────────────
// Flow:
//  1. requestPINReset() generates a 6-digit reset code, stores its hash +
//     a 15-minute expiry locally, and returns the plain code so the caller
//     can email it (via /api/vault-reset) to the account email.
//  2. User receives the code in their inbox, enters it.
//  3. verifyResetCode() checks it; if valid the UI lets them set a new PIN.

const resetKey = (mid, uid) => `wwi_vault_${mid}_${uid}_reset`

export async function requestPINReset(memorialId, userId) {
  const code = String(Math.floor(100000 + Math.random() * 900000)) // 6 digits
  const hash = await sha256(code + memorialId + userId)
  const payload = JSON.stringify({ hash, expires: Date.now() + 15 * 60 * 1000 })
  localStorage.setItem(resetKey(memorialId, userId), payload)
  return code // caller emails this; never stored in plain text
}

export async function verifyResetCode(memorialId, userId, code) {
  const raw = localStorage.getItem(resetKey(memorialId, userId))
  if (!raw) return false
  try {
    const { hash, expires } = JSON.parse(raw)
    if (Date.now() > expires) {
      localStorage.removeItem(resetKey(memorialId, userId))
      return false
    }
    const check = await sha256(String(code) + memorialId + userId)
    return check === hash
  } catch {
    return false
  }
}

export function clearResetCode(memorialId, userId) {
  localStorage.removeItem(resetKey(memorialId, userId))
}

// ─── Biometrics (WebAuthn) ────────────────────────────────────────────────────

export function isBiometricsAvailable() {
  return !!(
    window.PublicKeyCredential &&
    navigator.credentials &&
    typeof navigator.credentials.create === 'function'
  )
}

export async function isBiometricsConditionalAvailable() {
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}

function b64encode(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64decode(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/')
  while (str.length % 4) str += '='
  return Uint8Array.from(atob(str), c => c.charCodeAt(0))
}

export async function registerBiometrics(memorialId, userId, displayName = 'Vault Owner') {
  if (!isBiometricsAvailable()) throw new Error('Biometrics not available on this device')

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: {
        name: 'WHO WAS I Legacy Vault',
        id:   window.location.hostname,
      },
      user: {
        id:          new TextEncoder().encode(userId + memorialId),
        name:        userId,
        displayName: displayName,
      },
      pubKeyCredParams: [
        { alg: -7,   type: 'public-key' },  // ES256
        { alg: -257, type: 'public-key' },  // RS256 (fallback)
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',   // device biometrics only
        userVerification:        'required',   // forces Face ID / fingerprint
        residentKey:             'preferred',
      },
      timeout: 60000,
    },
  })

  // Store credential ID
  const credId = b64encode(credential.rawId)
  localStorage.setItem(credKey(memorialId, userId), credId)
  localStorage.setItem(setupKey(memorialId), '1')

  return credId
}

export async function authenticateWithBiometrics(memorialId, userId) {
  const storedCred = localStorage.getItem(credKey(memorialId, userId))
  if (!storedCred) throw new Error('No biometric credential registered')

  const challenge = crypto.getRandomValues(new Uint8Array(32))

  const assertion = await navigator.credentials.get({
    publicKey: {
      challenge,
      allowCredentials: [{
        id:   b64decode(storedCred),
        type: 'public-key',
      }],
      userVerification: 'required',
      timeout:          60000,
    },
  })

  // If we get here, authentication succeeded
  return !!assertion
}

export function hasBiometrics(memorialId, userId) {
  return !!localStorage.getItem(credKey(memorialId, userId))
}

export function removeBiometrics(memorialId, userId) {
  localStorage.removeItem(credKey(memorialId, userId))
}

// ─── Session management ───────────────────────────────────────────────────────
// Vault auto-locks after 10 minutes of inactivity

const SESSION_KEY     = (mid, uid) => `wwi_vault_${mid}_${uid}_session`
const SESSION_TIMEOUT = 10 * 60 * 1000   // 10 minutes

export function openSession(memorialId, userId) {
  localStorage.setItem(SESSION_KEY(memorialId, userId), Date.now().toString())
}

export function refreshSession(memorialId, userId) {
  if (isSessionValid(memorialId, userId)) {
    localStorage.setItem(SESSION_KEY(memorialId, userId), Date.now().toString())
  }
}

export function isSessionValid(memorialId, userId) {
  const ts = parseInt(localStorage.getItem(SESSION_KEY(memorialId, userId)) || '0', 10)
  return (Date.now() - ts) < SESSION_TIMEOUT
}

export function closeSession(memorialId, userId) {
  localStorage.removeItem(SESSION_KEY(memorialId, userId))
}

export function getSessionTimeLeft(memorialId, userId) {
  const ts    = parseInt(localStorage.getItem(SESSION_KEY(memorialId, userId)) || '0', 10)
  const left  = SESSION_TIMEOUT - (Date.now() - ts)
  return Math.max(0, Math.floor(left / 1000))
}
