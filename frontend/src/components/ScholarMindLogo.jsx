import React from 'react'

/**
 * ScholarMindLogo — Custom crafted logo emblem and wordmark for ScholarMind.
 *
 * Combines an academic mortarboard icon with an enlightened spark / brain motif
 * inside a modern squircle container.
 */
export function ScholarMindIcon({ size = 'md', className = '' }) {
  const sizeMap = {
    xs: 'w-5 h-5',
    sm: 'w-6 h-6',
    md: 'w-7 h-7',
    lg: 'w-10 h-10',
    xl: 'w-14 h-14',
  }

  const iconDimensions = {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 22,
    xl: 30,
  }

  const dim = iconDimensions[size] || 16

  return (
    <div
      className={`relative flex items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 via-blue-600 to-violet-600 text-white shadow-md shadow-indigo-500/20 ring-1 ring-white/20 select-none flex-shrink-0 ${sizeMap[size] || sizeMap.md} ${className}`}
    >
      <svg
        width={dim}
        height={dim}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transform transition-transform duration-200 group-hover:scale-105"
      >
        {/* Graduation cap mortarboard */}
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c3 3 9 3 12 0v-5" />
        {/* Glowing spark / mind node in center */}
        <circle cx="12" cy="10" r="1.5" fill="currentColor" />
      </svg>
    </div>
  )
}

export default function ScholarMindLogo({
  size = 'md',
  showTagline = false,
  className = '',
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <ScholarMindIcon size={size} />
      <div className="flex flex-col">
        <div className="flex items-center gap-1.5 leading-none">
          <span className="font-bold tracking-tight text-slate-900 dark:text-white text-base">
            Scholar<span className="text-indigo-600 dark:text-indigo-400">Mind</span>
          </span>
        </div>
        {showTagline && (
          <span className="text-[11px] text-slate-500 dark:text-slate-400 leading-tight mt-0.5">
            AI Learning Tutor
          </span>
        )}
      </div>
    </div>
  )
}
