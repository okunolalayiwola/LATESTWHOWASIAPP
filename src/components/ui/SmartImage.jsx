// src/components/ui/SmartImage.jsx
// Drop-in <img loading="lazy" decoding="async"> replacement that makes every image cheap:
//  • Cloudinary URLs get auto width/quality/format transforms (f_auto = WebP/AVIF)
//  • Native lazy-loading + async decode (offscreen images cost nothing)
//  • Blur-up: a tiny placeholder loads instantly, real image fades in
//  • Skips transforms for non-Cloudinary URLs (local assets, data URIs)
//
// Usage:
//   <SmartImage src={photo.url} alt={caption} w={800} className="..." />
//   <SmartImage src={memorial.photo} alt={name} w={1200} priority />   // hero
//
// `priority` = above-the-fold (hero/portrait): eager load, high fetch priority.
// Everything else lazy-loads as it scrolls into view.

import { useState } from 'react'

function cloudinary(url, width, { blur = false } = {}) {
  if (!url || typeof url !== 'string') return url
  if (!url.includes('res.cloudinary.com') || !url.includes('/upload/')) return url

  // Build a transform segment. f_auto + q_auto are the big wins.
  const t = blur
    ? 'e_blur:1200,q_1,f_auto,w_40'
    : `f_auto,q_auto,w_${width},c_limit,dpr_auto`

  return url.replace('/upload/', `/upload/${t}/`)
}

export default function SmartImage({
  src,
  alt = '',
  w = 800,
  className = '',
  style = {},
  priority = false,
  objectFit = 'cover',
  onClick,
}) {
  const [loaded, setLoaded] = useState(false)

  const isCloud   = typeof src === 'string' && src.includes('res.cloudinary.com')
  const fullSrc   = isCloud ? cloudinary(src, w) : src
  const blurSrc   = isCloud ? cloudinary(src, w, { blur: true }) : null

  return (
    <div
      className={className}
      onClick={onClick}
      style={{ position: 'relative', overflow: 'hidden', ...style }}
    >
      {/* Blur-up placeholder (Cloudinary only) — paints instantly */}
      {blurSrc && !loaded && (
        <img loading="lazy" decoding="async"
          src={blurSrc}
          alt=""
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit, filter: 'blur(12px)', transform: 'scale(1.05)',
          }}
        />
      )}

      <img loading="lazy" decoding="async"
        src={fullSrc}
        alt={alt}
        loading={priority ? 'eager' : 'lazy'}
        decoding="async"
        fetchpriority={priority ? 'high' : 'auto'}
        onLoad={() => setLoaded(true)}
        style={{
          width: '100%', height: '100%', objectFit,
          opacity: loaded || !blurSrc ? 1 : 0,
          transition: 'opacity 0.45s ease',
          position: 'relative',
        }}
      />
    </div>
  )
}
