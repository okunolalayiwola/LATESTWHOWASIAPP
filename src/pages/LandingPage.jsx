import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import heroImage from '../assets/hero-image.webp'
import landingBottomBg from '../assets/landing-bottom-bg.webp'

const chapters = [
  {
    eyebrow: 'Living Memorials',
    title: (
      <>
        <span className="t-line text-gradient-gold">Remember them</span>
        <span className="t-line text-gradient-warm">forever.</span>
      </>
    ),
    subtitle: 'Create a beautiful, living memorial for the people who shaped your life. Their story lives on — in their own voice, photos, and words.',
    cta: 'Start a Memorial',
    ctaLink: '/create',
  },
  {
    step: '01',
    title: 'Hear their voice again.',
    body: 'Upload a voice recording and their presence remains — speaking, laughing, telling their stories. A voice is the closest thing to being with them.',
  },
  {
    step: '02',
    title: 'A community of remembrance.',
    body: 'Leave a tribute, share a memory. The Explore section connects you with others celebrating lives well lived.',
  },
  {
    step: '03',
    title: 'Their story, beautifully told.',
    body: 'Photos, videos, tributes, and a timeline of a life — all presented with cinematic grace. Every life deserves to be remembered.',
    final: true,
  },
]

export default function LandingPage() {
  const [activeChapter, setActiveChapter] = useState(0)
  const [scrollProgress, setScrollProgress] = useState(0)
  const containerRef = useRef()

  useEffect(() => {
    const onScroll = () => {
      const scrollY = window.scrollY
      const maxScroll = window.innerHeight * 3
      const progress = Math.min(scrollY / maxScroll, 1)
      setScrollProgress(progress)

      const chapterIndex = Math.min(Math.floor(progress * chapters.length), chapters.length - 1)
      setActiveChapter(chapterIndex)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div ref={containerRef} className="relative">
      {/* Hero Section */}
      <section className="relative min-h-screen flex flex-col lg:flex-row">
        {/* Left: Profile Image */}
        <div className="relative w-full lg:w-1/2 h-[50vh] lg:h-screen flex items-center justify-center overflow-hidden">
          <div className="relative z-20 w-[min(70vw,28rem)] aspect-square rounded-full overflow-hidden border-2 border-white/10 shadow-2xl shadow-gold/10">
            <img
              src={heroImage}
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Right: Text Chapters */}
        <div className="relative w-full lg:w-1/2 min-h-[50vh] lg:h-screen flex items-center px-6 lg:px-12 py-20 lg:py-0">
          <div className="w-full max-w-lg">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeChapter}
                initial={{ opacity: 0, y: 28 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              >
                {activeChapter === 0 ? (
                  <>
                    <div className="flex items-center gap-2.5 mb-6">
                      <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse-glow" />
                      <span className="text-[0.65rem] font-bold tracking-[0.26em] uppercase text-cream-dim">
                        {chapters[0].eyebrow}
                      </span>
                    </div>
                    <h1 className="text-[clamp(2.2rem,5vw,4.4rem)] font-black leading-[1.05] tracking-[-0.025em] mb-5">
                      {chapters[0].title}
                    </h1>
                    <p className="text-[clamp(0.85rem,1.4vw,1.1rem)] font-light text-white leading-relaxed mb-8 max-w-md">
                      {chapters[0].subtitle}
                    </p>
                    <Link
                      to={chapters[0].ctaLink}
                      className="inline-flex items-center gap-2 bg-gradient-to-r from-gold to-sky text-black font-semibold text-sm tracking-wider px-7 py-3.5 rounded-full hover:scale-105 transition-transform shadow-lg shadow-gold/20"
                    >
                      {chapters[0].cta}
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                      </svg>
                    </Link>
                    {/* Scroll nudge */}
                    <div className="flex items-center gap-3 mt-10 animate-float">
                      <div className="flex flex-col items-center gap-1">
                        <div className="w-px h-5 bg-gradient-to-b from-transparent to-white/20" />
                        <div className="w-2 h-2 border-r border-b border-white/20 rotate-45 -mt-1" />
                      </div>
                      <span className="text-[0.6rem] tracking-[0.18em] uppercase text-white/20">Scroll</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-3 mb-5">
                      <div className="w-6 h-px bg-cream-dim" />
                      <span className="text-[0.6rem] font-bold tracking-[0.3em] text-cream-dim">
                        {chapters[activeChapter].step}
                      </span>
                    </div>
                    <h2 className="text-[clamp(1.8rem,3.5vw,3rem)] font-black leading-[1.1] tracking-[-0.02em] mb-4">
                      {chapters[activeChapter].step === '01' ? (
                        <span className="text-gradient-gold">{chapters[activeChapter].title}</span>
                      ) : chapters[activeChapter].step === '02' ? (
                        <span className="text-gradient-sky">{chapters[activeChapter].title}</span>
                      ) : (
                        <span className="text-gradient-warm">{chapters[activeChapter].title}</span>
                      )}
                    </h2>
                    <p className="text-sm lg:text-base font-light text-white leading-relaxed max-w-sm mb-6">
                      {chapters[activeChapter].body}
                    </p>
                    {chapters[activeChapter].final && (
                      <Link
                        to="/explore"
                        className="inline-flex items-center gap-2 bg-white/8 backdrop-blur-xl border border-white/10 text-white font-medium text-xs tracking-wider px-5 py-2.5 rounded-full hover:bg-white/12 transition-all"
                      >
                        Explore Memorials
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
                        </svg>
                      </Link>
                    )}
                  </>
                )}
              </motion.div>
            </AnimatePresence>

            {/* Progress bar */}
            <div className="mt-10 lg:mt-16">
              <div className="flex justify-between items-center mb-2">
                <span className="text-[0.55rem] tracking-[0.18em] uppercase text-white/18">
                  {chapters[activeChapter]?.step || 'Intro'}
                </span>
                <span className="text-[0.55rem] font-semibold text-white/25">
                  {Math.round(scrollProgress * 100)}%
                </span>
              </div>
              <div className="ecg-track">
                <div className="ecg-fill" style={{ width: `${scrollProgress * 100}%` }} />
              </div>
              <div className="flex items-center gap-2 mt-3">
                {chapters.map((_, i) => (
                  <div
                    key={i}
                    className={`w-1.5 h-1.5 rounded-full transition-all duration-500 ${
                      i === activeChapter ? 'bg-gold scale-125' : 'bg-white/10'
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24 lg:py-32">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-100px' }}
            transition={{ duration: 0.7 }}
            className="text-center mb-16"
          >
            <span className="text-[0.65rem] font-bold tracking-[0.26em] uppercase text-cream-dim">
              How It Works
            </span>
            <h2 className="text-[clamp(1.8rem,3vw,2.8rem)] font-black mt-3 leading-tight">
              A life, beautifully <span className="text-gradient-gold">remembered</span>
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                // Living memorial w/ live interaction — microphone + sound waves
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="11" rx="3" />
                    <path d="M5 10v2a7 7 0 0 0 14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="22" />
                    <line x1="8" y1="22" x2="16" y2="22" />
                  </svg>
                ),
                title: 'Living Memorial with Live Interaction',
                desc: 'Hear them speak again, ask them questions, share a moment. A voice-cloned, AI-powered conversation drawn from their life, words, and memories.',
                color: 'from-gold to-sky',
              },
              {
                // Digital barcode — QR code icon
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="7" height="7" rx="1" />
                    <rect x="14" y="3" width="7" height="7" rx="1" />
                    <rect x="3" y="14" width="7" height="7" rx="1" />
                    <line x1="14" y1="14" x2="14" y2="17" />
                    <line x1="17" y1="14" x2="21" y2="14" />
                    <line x1="21" y1="17" x2="17" y2="17" />
                    <line x1="14" y1="20" x2="21" y2="20" />
                    <line x1="17" y1="17" x2="17" y2="21" />
                  </svg>
                ),
                title: 'Digital Barcode for Every Memorial',
                desc: 'A unique QR code linked to each person. Print it on a headstone, wreath, card, or program — anyone who scans it is taken to the full living memorial.',
                color: 'from-sky to-lavender',
              },
              {
                // Legacy letters + will vault — padlock over document
                icon: (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <circle cx="12" cy="15.5" r="1.1" />
                    <line x1="12" y1="16.4" x2="12" y2="18" />
                  </svg>
                ),
                title: 'Legacy Vault & Family Communication',
                desc: 'Sealed letters, wills, and time-locked documents — opened on the day you choose. A private family channel for messages only your loved ones can read.',
                color: 'from-coral to-rose',
              },
            ].map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="glass rounded-2xl p-8 hover:bg-white/[0.06] transition-all duration-300 group"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center text-white mb-5`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-bold mb-2 leading-snug text-white">{f.title}</h3>
                <p className="text-sm text-white leading-relaxed">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="relative z-10 px-6 lg:px-12 py-24 lg:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7 }}
          >
            <h2 className="text-[clamp(1.8rem,3.5vw,3.2rem)] font-black leading-tight mb-4">
              Every life <span className="text-gradient-warm">deserves</span> to be remembered.
            </h2>
            <p className="text-sm lg:text-base text-white leading-relaxed max-w-lg mx-auto mb-8">
              Start their story today. Create a living memorial that will be cherished for generations.
            </p>
            <Link
              to="/create"
              className="inline-flex items-center gap-2 bg-gradient-to-r from-gold to-sky text-black font-semibold text-sm tracking-wider px-8 py-4 rounded-full hover:scale-105 transition-transform shadow-lg shadow-gold/20"
            >
              Begin Their Story
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
              </svg>
            </Link>
          </motion.div>
        </div>
      </section>

      {/* Bottom background image — fully feathered into the background */}
      <div className="absolute bottom-0 left-0 right-0 z-0 pointer-events-none h-[100vh]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage: `url(${landingBottomBg})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            opacity: 0.35,
            WebkitMaskImage: 'radial-gradient(ellipse 100% 60% at 50% 100%, black 30%, transparent 100%)',
            maskImage: 'radial-gradient(ellipse 100% 60% at 50% 100%, black 30%, transparent 100%)',
          }}
        />
      </div>

      {/* Footer */}
      <footer className="relative z-10 border-t border-white/5 px-6 lg:px-12 py-8">
        <div className="max-w-6xl mx-auto flex flex-col items-center gap-4">
          <div className="w-full flex flex-col md:flex-row items-center justify-between gap-4">
            <span className="text-xs tracking-wider text-white">
              WHO WAS I &middot; whowasi.uk &middot; v2.0
            </span>
            <div className="flex items-center gap-6">
              <Link to="/explore" className="text-[0.65rem] tracking-wider text-white hover:text-gold transition-colors">
                Explore
              </Link>
              <Link to="/auth" className="text-[0.65rem] tracking-wider text-white hover:text-gold transition-colors">
                Sign In
              </Link>
            </div>
          </div>

          {/* Creator credit */}
          <div className="w-full pt-4 border-t border-white/5 flex items-center justify-center gap-2">
            <span className="text-[0.65rem] tracking-[0.18em] uppercase text-white/55">
              Created by
            </span>
            <a
              href="https://okunolacreates.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[0.7rem] font-bold tracking-wider text-gold hover:text-sky transition-colors"
            >
              okunolacreates.com
            </a>
          </div>
        </div>
      </footer>
    </div>
  )
}
