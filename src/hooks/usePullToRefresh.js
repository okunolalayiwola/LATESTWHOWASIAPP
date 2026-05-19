// src/hooks/usePullToRefresh.js
// Lightweight pull-to-refresh hook for mobile web.
// Attaches touch event listeners to detect a pull-down gesture
// and triggers a refresh callback.
//
// Usage:
//   const { pulling, pullDistance } = usePullToRefresh({ onRefresh, threshold: 80 })

import { useState, useEffect, useRef, useCallback } from 'react'

export function usePullToRefresh({ onRefresh, threshold = 80 } = {}) {
  const [pulling, setPulling] = useState(false)
  const [pullDistance, setPullDistance] = useState(0)
  const startY = useRef(0)
  const pullingRef = useRef(false)

  const handleTouchStart = useCallback((e) => {
    // Only activate if scrolled to top
    if (window.scrollY > 0) return
    startY.current = e.touches[0].clientY
    pullingRef.current = false
  }, [])

  const handleTouchMove = useCallback((e) => {
    if (window.scrollY > 0) {
      if (pullingRef.current) {
        pullingRef.current = false
        setPulling(false)
        setPullDistance(0)
      }
      return
    }
    const delta = e.touches[0].clientY - startY.current
    if (delta > 0) {
      pullingRef.current = true
      setPulling(true)
      // Apply damping for natural feel
      setPullDistance(Math.min(delta * 0.5, threshold * 1.5))
    }
  }, [threshold])

  const handleTouchEnd = useCallback(() => {
    if (pullingRef.current && pullDistance >= threshold) {
      onRefresh?.()
    }
    pullingRef.current = false
    setPulling(false)
    setPullDistance(0)
  }, [pullDistance, threshold, onRefresh])

  useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchmove', handleTouchMove, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [handleTouchStart, handleTouchMove, handleTouchEnd])

  return { pulling, pullDistance }
}
