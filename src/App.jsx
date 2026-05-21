// src/App.jsx — MobileSimulator removed, SEO hooks integrated, PWA install banner

import { useEffect, useState, Suspense } from 'react'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'

import ErrorBoundary     from './components/ui/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
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
const SocialImportPage     = lazyWithRetry(() => import('./pages/SocialImportPage'))

const DashboardPage        = lazyWithRetry(() => import('./pages/DashboardPage'))
const ProfilePage          = lazyWithRetry(() => import('./pages/ProfilePage'))
const FamilyTreePage       = lazyWithRetry(() => import('./pages/FamilyTreePage'))
const SettingsPage         = lazyWithRetry(() => import('./pages/SettingsPage'))
const PremiumPage          = lazyWithRetry(() => import('./pages/PremiumPage'))

const ReelsPage            = lazyWithRetry(() => import('./pages/ReelsPage'))
const FacebookCallbackPage = lazyWithRetry(() => import('./pages/FacebookCallbackPage'))

const PrivacyPolicyPage    = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.PrivacyPolicyPage })))
const TermsPage            = lazyWithRetry(() => import('./pages/LegalPages').then(m => ({ default: m.TermsPage })))

const FamilyVerifyPage     = lazyWithRetry(() => import('./pages/FamilyVerifyPage'))
const JoinPage             = lazyWithRetry(() => import('./pages/JoinPage'))

// ─── Loaders ──────────────────────────────────────────────────────────────────

function PageLoader() {
  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center">
      <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
    </div>
  )
}

function AuthLoader() {
  return (
    <div className="relative min-h-screen bg-[#08080f] flex flex-col items-center justify-center gap-4">
      <div className="w-10 h-10 border-2 border-gold/30 border-t-gold rounded-full animate-spin" />
      <p className="text-brand text-xl">WHO WAS I</p>
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

  // ── Global SEO defaults ─────────────────────────────────────────────────────
  useSEO({
    title:       'WHO WAS I — Living Memorial Platform',
    description: 'Transform memories into a living digital legacy. Create AI-powered memorials with voice cloning, QR access, and family governance.',
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

              <Route path="/memorial/:id/conversation" element={<ConversationPage />}  />
              <Route path="/memorial/:id/letters"      element={<LegacyLettersPage />} />
              <Route path="/memorial/:id/import"       element={<SocialImportPage />}  />

              <Route path="/reels"       element={<ReelsPage />}          />
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
        <AppInner />
      </ToastProvider>
    </ErrorBoundary>
  )
}
