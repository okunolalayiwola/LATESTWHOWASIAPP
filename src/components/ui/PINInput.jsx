// src/components/ui/PINInput.jsx
// Native PIN entry — uses the device's own keyboard (laptop or phone).
// NO on-screen keypad. Replaces the old <PINPad> component.
//
// • 6 visible dot slots, but input comes from a single hidden native field
//   so the OS keyboard (numeric on phones) is used.
// • Auto-submits when 6 digits are entered.
// • Shake + clear on error.
//
// Props: onComplete(pin), label, error (bool), autoFocus (bool)

import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

export default function PINInput({ onComplete, label, error, autoFocus = true }) {
  const [value, setValue] = useState('')
  const [shake, setShake] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (error) {
      setShake(true)
      setValue('')
      const t = setTimeout(() => setShake(false), 500)
      return () => clearTimeout(t)
    }
  }, [error])

  useEffect(() => {
    if (autoFocus) {
      // slight delay so the field is mounted before focusing (mobile)
      const t = setTimeout(() => inputRef.current?.focus(), 120)
      return () => clearTimeout(t)
    }
  }, [autoFocus])

  function handleChange(e) {
    const next = e.target.value.replace(/\D/g, '').slice(0, 6)
    setValue(next)
    if (next.length === 6) {
      setTimeout(() => { onComplete(next); setValue('') }, 120)
    }
  }

  return (
    <div className="flex flex-col items-center">
      {label && (
        <p className="text-xs text-white/40 tracking-[0.18em] uppercase mb-6">{label}</p>
      )}

      {/* The whole row is a label so tapping anywhere focuses the hidden input
          and opens the device keyboard. */}
      <label className="relative cursor-text block">
        <motion.div
          animate={shake ? { x: [-8, 8, -8, 8, 0] } : {}}
          transition={{ duration: 0.35 }}
          className="flex gap-4"
          onClick={() => inputRef.current?.focus()}
        >
          {[0, 1, 2, 3, 4, 5].map(i => {
            const filled = i < value.length
            const isCursor = i === value.length
            return (
              <motion.div
                key={i}
                animate={{ scale: filled ? 1 : 0.72 }}
                transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                className="w-5 h-5 rounded-full transition-all"
                style={{
                  background: filled ? '#FFD700' : 'transparent',
                  border: `2px solid ${
                    filled ? '#FFD700'
                    : isCursor ? 'rgba(255,215,0,0.55)'
                    : 'rgba(255,255,255,0.20)'
                  }`,
                  boxShadow: filled ? '0 0 8px rgba(255,215,0,0.5)' : 'none',
                }}
              />
            )
          })}
        </motion.div>

        {/* Hidden native input — the real keyboard target.
            inputMode=numeric → phones show the number pad automatically. */}
        <input
          ref={inputRef}
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          value={value}
          onChange={handleChange}
          aria-label={label || 'Enter your vault PIN'}
          className="absolute inset-0 w-full h-full opacity-0"
          style={{ caretColor: 'transparent' }}
          maxLength={6}
        />
      </label>

      <p className="text-[0.65rem] text-white/25 mt-6">
        Type your 6-digit PIN using your keyboard
      </p>
    </div>
  )
}
