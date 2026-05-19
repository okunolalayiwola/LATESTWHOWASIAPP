// src/components/ui/Skeleton.jsx
// Reusable skeleton loading components for each major layout section.
// Usage: <SkeletonCard />, <SkeletonMemorialHero />, <SkeletonTribute />

const pulse = {
  animation: 'skeleton-pulse 1.8s ease-in-out infinite',
}

// Inject keyframes once
if (typeof document !== 'undefined' && !document.getElementById('sk-styles')) {
  const style = document.createElement('style')
  style.id    = 'sk-styles'
  style.innerHTML = `
    @keyframes skeleton-pulse {
      0%,100% { opacity: 0.4; }
      50%      { opacity: 0.9; }
    }
  `
  document.head.appendChild(style)
}

function SkBlock({ className = '', style = {}, rounded = 'rounded-xl' }) {
  return (
    <div
      className={`bg-white/8 ${rounded} ${className}`}
      style={{ ...pulse, ...style }}
    />
  )
}

// ─── Memorial hero skeleton ────────────────────────────────────────────────────
export function SkeletonMemorialHero() {
  return (
    <div>
      <SkBlock className="w-full" rounded="rounded-none" style={{ height: '52vh', minHeight: 320 }} />
      <div className="mx-4 -mt-1">
        <div className="glass rounded-2xl px-6 py-4 flex items-center justify-around">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="flex flex-col items-center gap-2">
              <SkBlock className="w-5 h-5" rounded="rounded-full" />
              <SkBlock className="w-8 h-5" />
              <SkBlock className="w-12 h-3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Tribute card skeleton ────────────────────────────────────────────────────
export function SkeletonTribute() {
  return (
    <div className="glass rounded-2xl p-5 flex gap-4">
      <SkBlock className="w-10 h-10 flex-shrink-0" rounded="rounded-full" />
      <div className="flex-1 space-y-2">
        <SkBlock className="w-32 h-4" />
        <SkBlock className="w-full h-3" />
        <SkBlock className="w-3/4 h-3" />
        <SkBlock className="w-1/2 h-3" />
      </div>
    </div>
  )
}

// ─── Memorial card skeleton (explore grid) ────────────────────────────────────
export function SkeletonMemorialCard() {
  return (
    <div className="glass rounded-2xl overflow-hidden">
      <SkBlock className="w-full h-40" rounded="rounded-none" />
      <div className="p-5 space-y-2">
        <SkBlock className="w-2/3 h-5" />
        <SkBlock className="w-1/3 h-3" />
        <SkBlock className="w-full h-3" />
        <SkBlock className="w-5/6 h-3" />
        <div className="flex gap-4 pt-1">
          <SkBlock className="w-16 h-3" />
          <SkBlock className="w-16 h-3" />
        </div>
      </div>
    </div>
  )
}

// ─── Dashboard stat skeleton ──────────────────────────────────────────────────
export function SkeletonStats() {
  return (
    <div className="grid grid-cols-4 gap-3">
      {[...Array(4)].map((_, i) => (
        <div key={i} className="glass rounded-2xl p-4 space-y-2">
          <SkBlock className="w-6 h-6" rounded="rounded-lg" />
          <SkBlock className="w-10 h-6" />
          <SkBlock className="w-full h-3" />
        </div>
      ))}
    </div>
  )
}

// ─── List item skeleton (memorials list, activity) ────────────────────────────
export function SkeletonListItem() {
  return (
    <div className="flex items-center gap-4 glass rounded-2xl p-4">
      <SkBlock className="w-12 h-12 flex-shrink-0" rounded="rounded-xl" />
      <div className="flex-1 space-y-2">
        <SkBlock className="w-2/3 h-4" />
        <SkBlock className="w-1/3 h-3" />
      </div>
      <SkBlock className="w-8 h-8" rounded="rounded-lg" />
    </div>
  )
}

// ─── Grid skeleton (explore page) ────────────────────────────────────────────
export function SkeletonGrid({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="glass rounded-2xl overflow-hidden">
          <SkBlock className="w-full h-40" rounded="rounded-none" />
          <div className="p-5 space-y-2">
            <SkBlock className="w-2/3 h-5" />
            <SkBlock className="w-1/3 h-3" />
            <SkBlock className="w-full h-3" />
            <SkBlock className="w-5/6 h-3" />
            <div className="flex gap-4 pt-1">
              <SkBlock className="w-16 h-3" />
              <SkBlock className="w-16 h-3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Profile header skeleton ──────────────────────────────────────────────────
export function SkeletonProfile() {
  return (
    <div className="flex gap-4 items-center">
      <SkBlock className="w-16 h-16 flex-shrink-0" rounded="rounded-full" />
      <div className="space-y-2">
        <SkBlock className="w-36 h-5" />
        <SkBlock className="w-24 h-3" />
      </div>
    </div>
  )
}
