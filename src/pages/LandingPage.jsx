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

          <style>{`
            .mc-grid {
              display: grid;
              grid-template-columns: 1fr;
              gap: 32px;
            }
            @media (min-width: 1024px) {
              .mc-grid { grid-template-columns: repeat(3, 1fr); }
            }

            .mc-card {
              position: relative;
              border-radius: 24px;
              padding: 24px 26px;
              isolation: isolate;
              overflow: hidden;
              background: linear-gradient(180deg, #1f2229 0%, #0b0c10 100%);
              box-shadow:
                0 1px 0 rgba(255,255,255,0.06) inset,
                0 -1px 0 rgba(0,0,0,0.6) inset,
                0 30px 60px -20px rgba(0,0,0,0.7),
                0 0 0 1px rgba(255,255,255,0.04);
            }
            .mc-card::before {
              content: "";
              position: absolute;
              inset: 0;
              background-image: radial-gradient(rgba(255,255,255,0.07) 1px, transparent 1px);
              background-size: 6px 6px;
              -webkit-mask-image: radial-gradient(ellipse 90% 80% at 30% 20%, black 0%, transparent 80%);
                      mask-image: radial-gradient(ellipse 90% 80% at 30% 20%, black 0%, transparent 80%);
              pointer-events: none;
              z-index: 0;
            }
            .mc-card::after {
              content: "";
              position: absolute;
              top: 0; left: 0; right: 0;
              height: 50%;
              background: linear-gradient(180deg, rgba(255,255,255,0.06) 0%, transparent 100%);
              pointer-events: none;
              z-index: 0;
              border-radius: 24px 24px 0 0;
            }

            .mc-content {
              position: relative;
              z-index: 2;
              display: flex;
              flex-direction: column;
              gap: 14px;
            }

            .mc-icon-wrap {
              position: relative;
              width: fit-content;
            }
            .mc-icon-wrap::before {
              content: "";
              position: absolute;
              inset: -8px;
              border-radius: 28px;
              filter: blur(20px);
              opacity: 0.55;
              z-index: -1;
            }
            .mc-card.voice .mc-icon-wrap::before { background: radial-gradient(circle, #f5b659 0%, transparent 70%); }
            .mc-card.code  .mc-icon-wrap::before { background: radial-gradient(circle, #6ee7ff 0%, transparent 70%); }
            .mc-card.vault .mc-icon-wrap::before { background: radial-gradient(circle, #c9a8ff 0%, transparent 70%); }

            .mc-icon-3d {
              width: 76px;
              height: 76px;
              border-radius: 22px;
              position: relative;
              display: grid;
              place-items: center;
              background: linear-gradient(160deg, #2a2d34 0%, #0c0d11 100%);
              box-shadow:
                0 1px 0 rgba(255,255,255,0.14) inset,
                0 -2px 6px rgba(0,0,0,0.5) inset,
                0 10px 20px -8px rgba(0,0,0,0.8),
                0 0 0 1px rgba(255,255,255,0.05);
            }
            .mc-icon-3d::before {
              content: "";
              position: absolute;
              inset: 1px;
              border-radius: 21px;
              background: linear-gradient(180deg, rgba(255,255,255,0.08) 0%, transparent 40%);
              pointer-events: none;
            }
            .mc-icon-3d svg {
              width: 40px;
              height: 40px;
              position: relative;
              z-index: 2;
            }
            .mc-card.voice .mc-icon-3d svg { filter: drop-shadow(0 0 8px #f5b659); color: #ffe6b3; }
            .mc-card.code  .mc-icon-3d svg { filter: drop-shadow(0 0 8px #6ee7ff); color: #d4f6ff; }
            .mc-card.vault .mc-icon-3d svg { filter: drop-shadow(0 0 8px #c9a8ff); color: #ece1ff; }

            .mc-title {
              font-family: 'DotGothic16', monospace;
              font-size: 22px;
              line-height: 1.15;
              letter-spacing: 0.02em;
              color: #ffffff;
              text-shadow: 0 0 8px rgba(255,255,255,0.25), 0 0 18px rgba(255,255,255,0.12);
              text-transform: uppercase;
              font-weight: 400;
            }
            .mc-card.voice .mc-title { color: #fff7e3; text-shadow: 0 0 10px rgba(245,182,89,0.35), 0 0 22px rgba(245,182,89,0.18); }
            .mc-card.code  .mc-title { color: #e6fbff; text-shadow: 0 0 10px rgba(110,231,255,0.35), 0 0 22px rgba(110,231,255,0.18); }
            .mc-card.vault .mc-title { color: #f3edff; text-shadow: 0 0 10px rgba(201,168,255,0.35), 0 0 22px rgba(201,168,255,0.18); }

            .mc-body {
              font-size: 14px;
              line-height: 1.5;
              color: #9ca0a8;
              font-weight: 400;
            }

            .mc-meta {
              display: flex;
              align-items: center;
              justify-content: space-between;
              margin-top: 4px;
              font-family: 'DotGothic16', monospace;
              font-size: 12px;
              letter-spacing: 0.08em;
              color: rgba(255,255,255,0.55);
              text-transform: uppercase;
            }
            .mc-meta .mc-dot {
              display: inline-block;
              vertical-align: middle;
              margin-right: 8px;
              width: 7px;
              height: 7px;
              border-radius: 50%;
              box-shadow: 0 0 8px 2px currentColor;
            }
            .mc-card.voice .mc-meta .mc-dot { background: #f5b659; color: #f5b659; }
            .mc-card.code  .mc-meta .mc-dot { background: #6ee7ff; color: #6ee7ff; }
            .mc-card.vault .mc-meta .mc-dot { background: #c9a8ff; color: #c9a8ff; }
          `}</style>

          <div className="mc-grid">
            {[
              {
                kind: 'voice',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="2" width="6" height="12" rx="3" fill="currentColor" fillOpacity="0.15" />
                    <path d="M5 11a7 7 0 0 0 14 0" />
                    <line x1="12" y1="18" x2="12" y2="22" />
                    <line x1="9" y1="22" x2="15" y2="22" />
                  </svg>
                ),
                titleLines: ['Living Memorial', 'with Live Interaction'],
                body: 'Hear them speak again, ask them questions, share a moment. A living conversation drawn from their voice, their words, and the memories you share.',
                metaLabel: 'Voice Active',
                step: '01 / 03',
              },
              {
                kind: 'code',
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <rect x="3" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="5.5" y="5.5" width="2" height="2" />
                    <rect x="14" y="3" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="16.5" y="5.5" width="2" height="2" />
                    <rect x="3" y="14" width="7" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.6" />
                    <rect x="5.5" y="16.5" width="2" height="2" />
                    <rect x="14" y="14" width="2" height="2" />
                    <rect x="17.5" y="14" width="2" height="2" />
                    <rect x="14" y="17.5" width="2" height="2" />
                    <rect x="17.5" y="17.5" width="2" height="2" />
                    <rect x="19" y="19" width="2" height="2" />
                  </svg>
                ),
                titleLines: ['Digital Barcode', 'for Every Memorial'],
                body: 'A unique QR code linked to each person. Print it on a headstone, wreath, card, or program. Anyone who scans it is taken to the full living memorial.',
                metaLabel: 'Scan Ready',
                step: '02 / 03',
              },
              {
                kind: 'vault',
                icon: (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="4" y="10" width="16" height="11" rx="2.5" fill="currentColor" fillOpacity="0.15" />
                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    <circle cx="12" cy="15" r="1.4" fill="currentColor" />
                    <line x1="12" y1="16.4" x2="12" y2="18.5" />
                  </svg>
                ),
                titleLines: ['Legacy Vault', '& Family Channel'],
                body: 'Sealed letters, wills, and time-locked documents, opened on the day you choose. A private family channel for messages only your loved ones can read.',
                metaLabel: 'Encrypted',
                step: '03 / 03',
              },
            ].map((f, i) => (
              <motion.article
                key={f.kind}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className={`mc-card ${f.kind}`}
              >
                <div className="mc-content">
                  <div className="mc-icon-wrap">
                    <div className="mc-icon-3d">{f.icon}</div>
                  </div>

                  <h3 className="mc-title">
                    {f.titleLines[0]}
                    <br />
                    {f.titleLines[1]}
                  </h3>

                  <p className="mc-body">{f.body}</p>

                  <div className="mc-meta">
                    <span>
                      <span className="mc-dot" />
                      {f.metaLabel}
                    </span>
                    <span>{f.step}</span>
                  </div>
                </div>
              </motion.article>
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

            {/* Creator credit — generous breathing room below the CTA */}
            <div className="mt-20 flex flex-col items-center gap-1.5">
              <span className="text-[0.6rem] tracking-[0.28em] uppercase text-white/55">
                Created by
              </span>
              <a
                href="https://okunolacreates.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-bold tracking-wider text-gold hover:text-sky transition-colors"
              >
                okunolacreates.com
              </a>
            </div>
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
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4">
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
      </footer>
    </div>
  )
}
