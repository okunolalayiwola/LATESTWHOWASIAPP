// src/lib/lazyWithRetry.js
//
// Resilient wrapper around React.lazy that survives the most common
// production failure mode for Vite SPAs:
//
//   TypeError: Failed to fetch dynamically imported module
//
// This happens when the user's browser holds an OLD index.html that
// references chunk filenames (e.g. MemorialDetailPage-BeKDULUb.js) that
// no longer exist on the server after a redeploy — the new build has
// new content-hashes (MemorialDetailPage-CNxN24UI.js, etc).
//
// Strategy:
//   1. Try the import.
//   2. On import-fetch failure, wait briefly and retry once (handles
//      transient network blips on flaky mobile).
//   3. If retry still fails, trigger a hard reload — the browser will
//      re-fetch index.html with the current chunk filenames, and the
//      next mount will use the right URLs.
//   4. Guard against infinite reload loops using sessionStorage so we
//      don't trap the user if the new build is genuinely broken.

import { lazy } from 'react'

const RELOAD_KEY = 'wwi_chunk_reload_at'
const RETRY_DELAY_MS = 800
const RELOAD_COOLDOWN_MS = 10_000    // don't reload again within this window

// Detect the specific "chunk no longer exists" error vs unrelated errors
// (e.g. a syntax error inside the chunk). We only auto-reload on the former.
export function isChunkLoadError(err) {
  if (!err) return false
  const msg = (err.message || '').toLowerCase()
  return (
    msg.includes('failed to fetch dynamically imported module') ||
    msg.includes('importing a module script failed') ||
    msg.includes('error loading dynamically imported module') ||
    msg.includes('failed to import') ||
    err.name === 'ChunkLoadError'
  )
}

function shouldReload() {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10)
    return !last || (Date.now() - last) > RELOAD_COOLDOWN_MS
  } catch { return true }
}

function markReloaded() {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch {}
}

/**
 * Drop-in replacement for React.lazy that retries once on import failure,
 * then triggers a single guarded page reload to pick up the fresh
 * index.html (which references the current chunk filenames).
 *
 * Usage:
 *   const MemorialDetailPage = lazyWithRetry(() => import('./pages/MemorialDetailPage'))
 */
export function lazyWithRetry(loader) {
  return lazy(async () => {
    try {
      return await loader()
    } catch (err) {
      if (!isChunkLoadError(err)) throw err

      // First attempt failed — wait briefly and retry (handles network blips)
      await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
      try {
        return await loader()
      } catch (err2) {
        if (!isChunkLoadError(err2)) throw err2

        // Retry still failed. The user is almost certainly on a stale
        // index.html referencing chunks that no longer exist. Reload
        // — but only if we haven't reloaded very recently, to avoid loops.
        if (shouldReload()) {
          markReloaded()
          // Reload from the server, not from cache
          window.location.reload()
          // Return a never-resolving promise so React doesn't briefly
          // render a fallback while the reload kicks in
          return new Promise(() => {})
        }

        // We've reloaded recently and it's still failing — let the
        // ErrorBoundary catch it so the user sees the proper fallback
        throw err2
      }
    }
  })
}

/**
 * Non-React variant for one-off dynamic imports (e.g. heavyweight modules
 * loaded outside of lazy()). Same retry + guarded-reload behaviour.
 */
export async function importWithRetry(loader) {
  try {
    return await loader()
  } catch (err) {
    if (!isChunkLoadError(err)) throw err
    await new Promise(r => setTimeout(r, RETRY_DELAY_MS))
    try {
      return await loader()
    } catch (err2) {
      if (isChunkLoadError(err2) && shouldReload()) {
        markReloaded()
        window.location.reload()
        return new Promise(() => {})
      }
      throw err2
    }
  }
}

// ─── Global unhandled-rejection listener ─────────────────────────────────────
// Catches the chunk error if it slips past lazy() (e.g. an import inside an
// event handler, a one-off dynamic import, an effect). Same guarded reload.
let listenerInstalled = false
export function installChunkErrorListener() {
  if (listenerInstalled || typeof window === 'undefined') return
  listenerInstalled = true

  window.addEventListener('unhandledrejection', e => {
    const err = e?.reason
    if (!isChunkLoadError(err)) return
    if (shouldReload()) {
      markReloaded()
      // Quietly reload — don't let the error bubble to the user
      e.preventDefault?.()
      window.location.reload()
    }
  })

  // Older browsers also raise via `error` event for script loads
  window.addEventListener('error', e => {
    const err = e?.error
    if (!isChunkLoadError(err)) return
    if (shouldReload()) {
      markReloaded()
      e.preventDefault?.()
      window.location.reload()
    }
  })
}
