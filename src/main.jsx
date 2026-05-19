import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'

// ── Service Worker cleanup ────────────────────────────────────────────────────
// The previous build registered a hand-written cache-first service worker
// (public/sw.js) — and registered it TWICE. It cached the app shell and, being
// cache-first with a fixed cache name, kept serving a stale/blank version
// regardless of new deploys. That is the blank-black-screen and the
// "reverted to an old version" symptom: same single root cause.
//
// This block actively UNREGISTERS any existing service worker and DELETES all
// caches on every visit, which un-sticks affected browsers. It registers NO
// new service worker. A proper auto-updating SW (vite-plugin-pwa) can be
// reintroduced later as a separate, deliberate step once users are unstuck.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const regs = await navigator.serviceWorker.getRegistrations()
      await Promise.all(regs.map((r) => r.unregister()))
      if (window.caches) {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // If cleanup fails the app still loads fine straight from the network.
    }
  })
}

// ── Network status monitoring ──────────────────────────────────────────────────
window.addEventListener('online',  () => document.body.classList.remove('offline'))
window.addEventListener('offline', () => document.body.classList.add('offline'))

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
