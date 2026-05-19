// src/pages/NotFoundPage.jsx
// Shown for any unmatched route via <Route path="*" element={<NotFoundPage />} />
// Auto-redirects to home after 8 seconds.

import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

export default function NotFoundPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/'), 8000)
    return () => clearTimeout(t)
  }, [navigate])

  return (
    <div className="dark-container relative z-10 min-h-screen flex flex-col items-center justify-center px-6 text-center">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Decorative symbols */}
        <div className="flex justify-center gap-3 mb-10 opacity-15">
          {['✦', '◎', '✿', '☽', '♡'].map((s, i) => (
            <motion.span
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="text-2xl"
            >
              {s}
            </motion.span>
          ))}
        </div>

        <span className="text-[0.65rem] font-bold tracking-[0.22em] uppercase text-cream-dim block mb-3">
          404 — Page not found
        </span>

        <h1 className="font-display text-[clamp(2.4rem,7vw,4rem)] font-bold leading-tight mb-4">
          This page has{' '}
          <span className="text-gradient-gold">passed on</span>
        </h1>

        <p className="text-sm text-white/40 max-w-xs mx-auto mb-10 leading-relaxed">
          The page you're looking for doesn't exist or may have been moved. You'll be redirected home in a moment.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link to="/"
            className="inline-block bg-gradient-to-r from-gold to-sky text-black text-xs font-bold tracking-widest uppercase px-8 py-3.5 rounded-full hover:opacity-90 transition-opacity">
            Go home
          </Link>
          <Link to="/explore"
            className="inline-block glass border border-white/10 text-white/60 hover:text-white text-xs font-bold tracking-widest uppercase px-8 py-3.5 rounded-full hover:border-white/20 transition-all">
            Explore memorials
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
