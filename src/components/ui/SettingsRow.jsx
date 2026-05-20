// src/components/ui/SettingsRow.jsx
//
// Single source of truth for "rows in account/settings sections."
// Replaces the older inline SettingsRow that was scattered across pages and
// always rendered a chevron arrow even when the row did nothing on click.
//
// Three honest variants:
//
//   <SettingsRow label="..." value="..." onClick={fn} />
//     Interactive. Chevron arrow + hover + click. Use only when tapping
//     actually navigates or opens a modal.
//
//   <SettingsRow info label="..." value="..." />
//     Informational. NO chevron, NO hover, NOT a button. Just shows a
//     label and value (e.g. the user's email, the current language). The
//     rule: if onClick would have been a no-op, use info instead.
//
//   <SettingsRow danger label="..." onClick={fn} />
//     Destructive action (delete account, etc.). Rose-tinted, interactive.
//
// This is the structural part of the "no phantom rows" rule — by making
// info-only rows look visibly different (no chevron, no hover), it's
// impossible to accidentally create the "looks tappable but does nothing"
// problem app-wide.

export default function SettingsRow({
  icon,
  label,
  value,
  description,
  onClick,
  badge,
  danger,
  info,
}) {
  // Info variant: a plain div, not a button. No chevron. No hover.
  if (info) {
    return (
      <div className="w-full flex items-center gap-4 px-5 py-4 border-b border-white/[0.05] last:border-0">
        {icon && (
          <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-base flex-shrink-0">
            {icon}
          </div>
        )}
        <div className="flex-1 text-left min-w-0">
          <span className="text-sm font-medium text-white/85">{label}</span>
          {value && <p className="text-xs text-white/35 mt-0.5 truncate">{value}</p>}
          {description && !value && (
            <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
        {badge && (
          <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-white/10 text-white/50 flex-shrink-0">
            {badge}
          </span>
        )}
      </div>
    )
  }

  // Interactive variant (default or danger): a real button with chevron.
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-4 px-5 py-4 border-b border-white/[0.05] last:border-0 hover:bg-white/[0.03] transition-colors ${danger ? 'text-rose/70' : 'text-white'}`}
    >
      {icon && (
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-base flex-shrink-0 ${danger ? 'bg-rose/10' : 'bg-white/6'}`}>
          {icon}
        </div>
      )}
      <div className="flex-1 text-left min-w-0">
        <span className="text-sm font-medium">{label}</span>
        {value && <p className="text-xs text-white/30 mt-0.5 truncate">{value}</p>}
        {description && !value && (
          <p className="text-xs text-white/30 mt-0.5 leading-relaxed">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {badge && (
          <span className="text-[0.55rem] font-bold px-2 py-0.5 rounded-full bg-gold/15 border border-gold/25 text-gold/80">
            {badge}
          </span>
        )}
        <svg className={`w-4 h-4 ${danger ? 'text-rose/30' : 'text-white/20'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </button>
  )
}
