// src/contexts/PaywallContext.jsx
// App-wide plan/entitlement access + the upgrade cutoff.
//
//   const { plan, can, limit, requireFeature } = usePaywall()
//   if (!requireFeature('voiceCapture')) return   // shows the subscribe modal
//
// `requireFeature` returns true when the current plan allows the feature, and
// otherwise opens the upgrade modal and returns false — so callers can guard a
// handler in a single line.

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { db } from '../lib/instant'
import { normalizePlan, hasFeature, planLimit } from '../lib/plans'
import UpgradeModal from '../components/ui/UpgradeModal'

const PaywallCtx = createContext(null)

const FALLBACK = {
  plan: 'free',
  ready: true,
  can: () => true,
  limit: () => Infinity,
  requireFeature: () => true,
  openUpgrade: () => {},
}

export function PaywallProvider({ children }) {
  const { user, isLoading: authLoading } = db.useAuth()
  const { data, isLoading } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null,
  )
  const plan = normalizePlan(data?.profiles?.[0]?.plan)
  // `ready` is true once the real plan is known — guards on-mount gates from
  // false-firing on paying users during the brief load window (plan starts 'free').
  const ready = !authLoading && (!user || !isLoading)
  const [gate, setGate] = useState(null) // { feature } while the modal is open

  const can            = useCallback((feature) => hasFeature(plan, feature), [plan])
  const limit          = useCallback((key) => planLimit(plan, key), [plan])
  const openUpgrade    = useCallback((feature) => setGate({ feature }), [])
  const requireFeature = useCallback((feature) => {
    if (hasFeature(plan, feature)) return true
    setGate({ feature })
    return false
  }, [plan])

  const value = useMemo(
    () => ({ plan, ready, can, limit, requireFeature, openUpgrade }),
    [plan, ready, can, limit, requireFeature, openUpgrade],
  )

  return (
    <PaywallCtx.Provider value={value}>
      {children}
      <UpgradeModal gate={gate} onClose={() => setGate(null)} />
    </PaywallCtx.Provider>
  )
}

export function usePaywall() {
  return useContext(PaywallCtx) || FALLBACK
}
