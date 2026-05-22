// useSEO — Dynamically update <title> and meta tags per page/memorial
// Usage: useSEO({ title: 'My Memorial', description: '...', image: '...' })

import { useEffect } from 'react'

const DEFAULT = {
  title: 'WHO WAS I — Living Memorials',
  description:
    'Create a living memorial with voice, stories, and a QR code that brings it to life anywhere.',
  image: '/og-default.jpg',
  url: 'https://whowasi.uk',
}

export default function useSEO(opts = {}) {
  const { title, description, image, url } = { ...DEFAULT, ...opts }

  useEffect(() => {
    // ── Title ──────────────────────────────────────────────────────────────
    document.title = title

    // ── Meta helpers ───────────────────────────────────────────────────────
    const setMeta = (name, content) => {
      let el = document.querySelector(`meta[name="${name}"], meta[property="${name}"]`)
      if (!el) {
        el = document.createElement('meta')
        el.setAttribute(
          name.startsWith('og:') || name.startsWith('twitter:') ? 'property' : 'name',
          name,
        )
        document.head.appendChild(el)
      }
      el.setAttribute('content', content)
    }

    // ── Standard meta ──────────────────────────────────────────────────────
    setMeta('description', description)

    // ── Open Graph ─────────────────────────────────────────────────────────
    setMeta('og:title', title)
    setMeta('og:description', description)
    setMeta('og:image', image)
    setMeta('og:url', url || DEFAULT.url)

    // ── Twitter ────────────────────────────────────────────────────────────
    setMeta('twitter:title', title)
    setMeta('twitter:description', description)
    setMeta('twitter:image', image)
  }, [title, description, image, url])
}
