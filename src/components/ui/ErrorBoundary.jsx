// src/components/ui/ErrorBoundary.jsx
// Catches any unhandled React render errors and shows a graceful fallback.
// Wrap around <App /> in main.jsx or around individual routes.

import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    // Log to your error tracker (Sentry, etc.) here
    console.error('[ErrorBoundary]', error, info)
  }

  render() {
    if (!this.state.hasError) return this.props.children

    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          fontFamily: 'Inter, sans-serif',
          color: '#fff',
          flexDirection: 'column',
          textAlign: 'center',
        }}
      >
        <div style={{ fontSize: 48, opacity: 0.15, marginBottom: 24 }}>✦</div>
        <p style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
          Something went wrong
        </p>
        <h1 style={{ fontFamily: 'Cormorant Garamond, serif', fontSize: 32, fontWeight: 700, marginBottom: 12 }}>
          We hit an unexpected error
        </h1>
        <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.4)', maxWidth: 360, lineHeight: 1.6, marginBottom: 32 }}>
          The page encountered a problem. Your data is safe. Please refresh to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            background: 'linear-gradient(to right, #d4a853, #e8824a)',
            color: '#000',
            border: 'none',
            borderRadius: 999,
            padding: '12px 32px',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Refresh page
        </button>
        {process.env.NODE_ENV === 'development' && this.state.error && (
          <pre style={{ marginTop: 32, padding: 16, background: 'rgba(255,255,255,0.04)', borderRadius: 12, fontSize: 11, color: 'rgba(255,80,80,0.7)', maxWidth: 480, textAlign: 'left', overflowX: 'auto' }}>
            {this.state.error.toString()}
          </pre>
        )}
      </div>
    )
  }
}
