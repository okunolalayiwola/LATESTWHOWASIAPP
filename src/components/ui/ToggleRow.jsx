// src/components/ui/ToggleRow.jsx
// A switch row used by ProfilePage for notification toggles.

import { useState } from 'react'

export default function ToggleRow({ icon, label, description, value, onChange }) {
  const [internal, setInternal] = useState(value ?? true)

  const isOn = value !== undefined ? value : internal

  function handleToggle() {
    const next = !isOn
    if (onChange) {
      onChange(next)
    } else {
      setInternal(next)
    }
  }

  return (
    <div className="w-full flex items-center gap-4 px-5 py-4 border-b border-white/[0.05] last:border-0">
      {icon && (
        <div className="w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 bg-white/6">
          {icon}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium text-white">{label}</span>
        {description && (
          <p className="text-xs text-white/30 mt-0.5">{description}</p>
        )}
      </div>
      <button
        onClick={handleToggle}
        role="switch"
        aria-checked={isOn}
        className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
          isOn ? 'bg-gold/60' : 'bg-white/10'
        }`}
      >
        <span
          className={`block w-4 h-4 bg-white rounded-full shadow-sm transition-transform mt-1 ${
            isOn ? 'translate-x-[22px]' : 'translate-x-[3px]'
          }`}
        />
      </button>
    </div>
  )
}
