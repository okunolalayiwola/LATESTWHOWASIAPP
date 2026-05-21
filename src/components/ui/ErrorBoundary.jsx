// src/components/ui/ErrorBoundary.jsx
// Catches any unhandled React render errors and shows a graceful fallback.
//
// Special-cases the Vite "Failed to fetch dynamically imported module" error:
// this is almost always caused by a stale index.html referencing chunk
// filenames that no longer exist after a redeploy. When detected, we
// auto-reload the page (with a loop guard) so the user gets the fresh
// index.html silently instead of seeing the generic error screen.
//
// Wrap around <App /> in main.jsx or around individual routes.

import { Component } from 'react'
import { isChunkLoadError } from '../../lib/lazyWithRetry'

const RELOAD_KEY = 'wwi_chunk_reload_at'
const RELOAD_COOLDOWN_MS = 10_000

function shouldAutoReload() {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_KEY) || '0', 10)
    return !last || (Date.now() - last) > RELOAD_COOLDOWN_MS
  } catch { return true }
}

function markReloaded() {
  try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())) } catch {}
}

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null, isChunkError: false }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      isChunkError: isChunkLoadError(error),
    }
  }

  componentDidCatch(error, info) {
    // Stale-chunk errors after deploys are recoverable — auto-reload once,
    // guarded by sessionStorage so we don't loop if it's actually broken.
    if (isChunkLoadError(error) && shouldAutoReload()) {
      markReloaded()
      // Reload from the server, not from the bfcache
      try { window.location.reload() } catch {}
      return
    }
    // Anything else: log so we can surface it. (Wire to Sentry/etc here.)
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    // Chunk error: we're about to reload — render a quiet loading screen
    // so the user doesn't see a flash of the error UI.
    if (this.state.isChunkError) {
      return (
        <div style={{
          minHeight: '100vh', background: '#08080f',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexDirection: 'column', gap: 16,
          fontFamily: 'Inter, sans-serif', color: '#fff',
        }}>
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            border: '2px solid rgba(255,215,0,0.20)',
            borderTopColor: '#FFD700',
            animation: 'wwi-spin 0.8s linear infinite',
          }} />
          <p style={{ fontSize: 11, letterSpacing: '0.22em', textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.35)' }}>
            Updating…
          </p>
          <style>{`@keyframes wwi-spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )
    }

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'Inter, sans-serif',
          color: '#fff',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 24 }}>✦</div>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
          Something went wrong
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          We hit an unexpected error
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
          The page encountered a problem. Your data is safe. Please refresh to continue.
        </p>
        <button
          onClick={() => {
            // Hard reload — bypass bfcache so stale chunk refs get cleared
            try { markReloaded() } catch {}
            window.location.reload()
          }}
          style={{
            background: 'linear-gradient(to right, #d4a853, #e8824a)',
            color: '#000',
            border: 'none',
            borderRadius: 999,
            padding: '12px 32px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Refresh page
        </button>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre style={{ marginTop: 32, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, fontSize: 11, color: 'rgba(255,80,80,0.7)', maxWidth: 480, textAlign: 'left', overflowX: 'auto' }}>
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    )
  }
}
