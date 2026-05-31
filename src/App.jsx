// src/App.jsx — MobileSimulator removed, SEO hooks integrated, PWA install banner

import { useEffect, useState, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import ErrorBoundary     from './components/ui/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import { PaywallProvider } from './contexts/PaywallContext'
import BokehBackground   from './components/BokehBackground'
import Navigation        from './components/Navigation'
import BottomNav         from './components/BottomNav'
import { db }            from './lib/instant'
import { useSEO }        from './hooks'
import { lazyWithRetry, installChunkErrorListener } from './lib/lazyWithRetry'

// Install global chunk-error listener once — catches stale chunk references
// that escape React.lazy (e.g. imports inside event handlers/effects).
installChunkErrorListener()

// ─── Lazy pages — every dynamic import uses retry + auto-reload on stale chunks
// Vite content-hashes chunk filenames; after a deploy the user's cached
// index.html references chunks that no longer exist. lazyWithRetry retries
// once, then reloads the page to fetch the fresh index.html.

const LandingPage          = lazyWithRetry(() => import('./pages/LandingPage'))
const AuthPage             = lazyWithRetry(() => import('./pages/AuthPage'))
const OnboardingPage       = lazyWithRetry(() => import('./pages/OnboardingPage'))
const NotFoundPage         = lazyWithRetry(() => import('./pages/NotFoundPage'))

const ExplorePage          = lazyWithRetry(() => import('./pages/ExplorePage'))
const MemorialDetailPage   = lazyWithRetry(() => import('./pages/MemorialDetailPage'))
const CreateMemorialPage   = lazyWithRetry(() => import('./pages/CreateMemorialPage'))
const EditMemorialPage     = lazyWithRetry(() => import('./pages/EditMemorialPage'))

const ConversationPage     = lazyWithRetry(() => import('./pages/ConversationPage'))
const LegacyLettersPage    = lazyWithRetry(() => import('./pages/LegacyLettersPage'))

const DashboardPage        = lazyWithRetry(() => import('./pages/DashboardPage'))
const ProfilePage          = lazyWithRetry(() => import('./pages/ProfilePage'))
const FamilyTreePage       = lazyWithRetry(() => import('./pages/FamilyTreePage'))
const SettingsPage         = lazyWithRetry(() => import('./pages/SettingsPage'))
const PremiumPage          = lazyWithRetry(() => import('./pages/PremiumPage'))

const ReelsPage            = lazyWithRetry(() => import('./pages/ReelsPage'))
const ChatPage             = lazyWithRetry(() => import('./pages/ChatPage'))
const PersonaProfilePage   = lazyWithRetry(() => import('./pages/PersonaProfilePage'))
const FacebookCallbackPage = lazyWithRetry(() => import('./pages/FacebookCallbackPage'))

const PrivacyPolicyPage    = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPolicyPage })))
const TermsPage            = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.TermsPage })))

const FamilyVerifyPage     = lazyWithRetry(() => import('./pages/FamilyVerifyPage'))
const JoinPage             = lazyWithRetry(() => import('./pages/JoinPage'))

// ─── Loaders ──────────────────────────────────────────────────────────────────
// PageLoader holds its breath for 180ms before appearing — fast route swaps
// land before it ever paints, so the UI feels instant. Slower navigations
// fade the spinner in so the appearance isn't jarring. Uses a neutral cream
// palette so it works on both dark and pastel backgrounds.

function PageLoader() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 180)
    return () => clearTimeout(t)
  }, [])
  return (
    <div
      className="relative z-10 min-h-[60vh] flex items-center justify-center"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity .35s ease',
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div className="flex flex-col items-center gap-3">
        <div
          className="w-9 h-9 rounded-full animate-spin"
          style={{
            border: '2.5px solid rgba(241,236,225,0.16)',
            borderTopColor: 'rgba(241,236,225,0.85)',
          }}
        />
        <span
          className="text-[0.6rem] tracking-[0.28em] uppercase font-semibold"
          style={{ color: 'rgba(241,236,225,0.45)' }}
        >
          Loading
        </span>
      </div>
    </div>
  )
}

function AuthLoader() {
  return (
    <div className="relative min-h-screen bg-[#08080f] flex flex-col items-center justify-center gap-5">
      <div
        className="w-11 h-11 rounded-full animate-spin"
        style={{
          border: '2.5px solid rgba(241,236,225,0.18)',
          borderTopColor: 'rgba(241,236,225,0.9)',
        }}
      />
      <p className="text-brand text-xl" style={{ letterSpacing: '0.06em' }}>WHO WAS I</p>
    </div>
  )
}

// ─── Onboarding guard ─────────────────────────────────────────────────────────
// Rules:
//  1. Brand-new visitor (no wwi_has_visited in localStorage) → /onboarding
//  2. Logged-in user with completed profile → set the flag + allow through
//  3. Logged-in user without completed profile → /onboarding
//
// Public routes (explore, memorial pages, landing) are always skipped so
// guests can browse without being blocked.

function OnboardingGuard({ children }) {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, isLoading } = db.useAuth()

  const { data } = db.useQuery(
    user ? { profiles: { $: { where: { userId: user.id } } } } : null
  )

  // Routes that are always accessible — no onboarding check
  const SKIP = ['/', '/auth', '/onboarding', '/privacy', '/terms', '/explore', '/reels', '/premium', '/join']
  const shouldSkip = SKIP.includes(location.pathname)
    || location.pathname.startsWith('/memorial')
    || location.pathname.startsWith('/connect')

  useEffect(() => {
    if (shouldSkip || isLoading) return

    // ── Logged-in user ─────────────────────────────────────────────────────
    if (user) {
      if (!data) return  // wait for profile query
      const profile = data.profiles?.[0]
      // Consider onboarded if: explicit flag OR has a name (handles users who
      // completed onboarding before the flag was introduced)
      const isOnboarded = profile?.onboarded === true
        || !!(profile?.firstName || profile?.displayName)
      if (isOnboarded) {
        // Stamp the localStorage flag so the guest check below never fires again
        localStorage.setItem('wwi_has_visited', '1')
        return
      }
      // Logged in but hasn't completed onboarding yet
      navigate('/onboarding', { replace: true })
      return
    }

    // ── Guest / unauthenticated user ───────────────────────────────────────
    const visited = localStorage.getItem('wwi_has_visited')
    if (!visited) {
      navigate('/onboarding', { replace: true })
    }
  }, [user, data, shouldSkip, isLoading, navigate])

  return children
}

// ─── PWA install banner ───────────────────────────────────────────────────────

function PWAInstallBanner() {
  const [prompt,  setPrompt]  = useState(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const h = e => { e.preventDefault(); setPrompt(e); setVisible(true) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])

  if (!visible) return null

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-sm px-4 pointer-events-none">
      <div className="pointer-events-auto glass border border-gold/20 rounded-2xl px-5 py-4 flex items-center gap-4 shadow-xl shadow-black/50">
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">Install WHO WAS I</p>
          <p className="text-xs text-white/40 mt-0.5">Add to your home screen</p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => setVisible(false)} className="text-xs text-white/30 hover:text-white/60 transition-colors">Later</button>
          <button
            onClick={async () => {
              if (prompt) {
                prompt.prompt()
                const { outcome } = await prompt.userChoice
                if (outcome === 'accepted') setVisible(false)
              }
            }}
            className="text-xs font-bold text-black bg-gradient-to-r from-gold to-sky px-3 py-1.5 rounded-full hover:opacity-90"
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── App inner ────────────────────────────────────────────────────────────────

function AppInner() {
  const location = useLocation()
  const { isLoading: authLoading } = db.useAuth()

  // ── Scroll to top on every route change ────────────────────────────────────
  // Without this, the browser preserves the previous page's scroll offset.
  // When the user navigates from a long page (e.g. memorial detail) to a
  // shorter one (dashboard), they land at the previous scroll Y and see
  // the bottom of the new page mid-mount, which looks glitchy.
  useEffect(() => {
    // `instant` (not smooth) — avoids a visible animation that feels wrong on nav
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' })
  }, [location.pathname])

  // ── Global SEO defaults ─────────────────────────────────────────────────────
  useSEO({
    title:       'WHO WAS I — Living Memorial Platform',
    description: 'Transform memories into a living digital legacy. Memorials with voice, photos, stories, QR access, and family governance — built to be remembered.',
    image:       'https://whowasi.uk/og-default.jpg',
    url:         'https://whowasi.uk' + location.pathname,
  })

  if (authLoading) return <AuthLoader />

  return (
    <div className="relative min-h-screen bg-[#08080f] text-white">
      <BokehBackground />
      <Navigation />
      <PWAInstallBanner />

      <OnboardingGuard>
        <Suspense fallback={<PageLoader />}>
          <AnimatePresence mode="wait">
            <Routes location={location} key={location.pathname}>

              <Route path="/"            element={<LandingPage />}        />
              <Route path="/auth"        element={<AuthPage />}           />
              <Route path="/onboarding"  element={<OnboardingPage />}     />

              <Route path="/explore"             element={<ExplorePage />}        />
              <Route path="/memorial/:id"        element={<MemorialDetailPage />} />
              <Route path="/memorial/:id/edit"   element={<EditMemorialPage />}   />

              <Route path="/memorial/:id/conversation" element={<ConversationPage />}    />
              <Route path="/memorial/:id/letters"      element={<LegacyLettersPage />}   />
              <Route path="/memorial/:id/persona"      element={<PersonaProfilePage />}  />

              <Route path="/reels"       element={<ReelsPage />}          />
              <Route path="/chat"        element={<ChatPage />}           />
              <Route path="/create"      element={<CreateMemorialPage />} />
              <Route path="/dashboard"   element={<DashboardPage />}      />
              <Route path="/profile"     element={<ProfilePage />}        />
              <Route path="/family-tree" element={<FamilyTreePage />}     />
              <Route path="/settings"    element={<SettingsPage />}       />
              <Route path="/premium"     element={<PremiumPage />}        />

              <Route path="/connect/facebook/callback" element={<FacebookCallbackPage />} />
              <Route path="/join"                      element={<JoinPage />}             />
              <Route path="/connect/family/verify/:token" element={<FamilyVerifyPage />} />

              <Route path="/privacy"     element={<PrivacyPolicyPage />}  />
              <Route path="/terms"       element={<TermsPage />}          />
              <Route path="*"            element={<NotFoundPage />}       />

            </Routes>
          </AnimatePresence>
        </Suspense>
      </OnboardingGuard>

      <BottomNav />
    </div>
  )
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <PaywallProvider>
          <AppInner />
        </PaywallProvider>
      </ToastProvider>
    </ErrorBoundary>
  )
}
