// src/contexts/ToastContext.jsx
// Global toast notification system.
// Usage: const { toast } = useToast()
//        toast.success('Memorial saved')
//        toast.error('Something went wrong')
//        toast.info('Link copied')

import { createContext, useContext, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const ToastContext = createContext(null)

const ICONS = {
  success: '✓',
  error:   '✕',
  info:    '◎',
  warning: '⚠',
}

const STYLES = {
  success: 'border-emerald-500/30 text-emerald-300',
  error:   'border-red-500/30    text-red-300',
  info:    'border-gold/30        text-gold',
  warning: 'border-amber-500/30   text-amber-300',
}

function ToastItem({ toast, onDismiss }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 24, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 24, scale: 0.95 }}
      transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      onClick={() => onDismiss(toast.id)}
      className={`dark-container flex items-center gap-3 px-4 py-3 rounded-2xl bg-[#111] border cursor-pointer select-none ${STYLES[toast.type] || STYLES.info}`}
      style={{ backdropFilter: 'blur(12px)', maxWidth: 320, minWidth: 220 }}
    >
      <span className="text-base flex-shrink-0">{ICONS[toast.type]}</span>
      <span className="text-sm font-medium text-white/90 flex-1">{toast.message}</span>
    </motion.div>
  )
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const counter  = useRef(0)

  const dismiss = useCallback(id => {
    setToasts(ts => ts.filter(t => t.id !== id))
  }, [])

  const show = useCallback((message, type = 'info', duration = 3000) => {
    const id = ++counter.current
    setToasts(ts => [...ts, { id, message, type }])
    setTimeout(() => dismiss(id), duration)
  }, [dismiss])

  const toast = {
    success: (msg, dur) => show(msg, 'success', dur),
    error:   (msg, dur) => show(msg, 'error',   dur ?? 4000),
    info:    (msg, dur) => show(msg, 'info',    dur),
    warning: (msg, dur) => show(msg, 'warning', dur),
  }

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {/* Toast container — fixed bottom center */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[999] flex flex-col items-center gap-2 pointer-events-none">
        <AnimatePresence mode="popLayout">
          {toasts.map(t => (
            <div key={t.id} className="pointer-events-auto">
              <ToastItem toast={t} onDismiss={dismiss} />
            </div>
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside ToastProvider')
  return ctx
}
