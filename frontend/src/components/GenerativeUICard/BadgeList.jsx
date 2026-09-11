/**
 * components/GenerativeUICard/BadgeList.jsx
 *
 * Renders a list of labeled badges in light theme.
 */
import React from 'react'

const VARIANT_STYLES = {
  default: 'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950/40 dark:border-blue-800 dark:text-blue-300',
  success: 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-300',
  warning: 'bg-amber-50 border-amber-200 text-amber-800 dark:bg-amber-950/40 dark:border-amber-800 dark:text-amber-300',
  error:   'bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-800 dark:text-rose-300',
}

export default function BadgeList({ data }) {
  const { title, items = [] } = data

  return (
    <div className="glass-card p-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm rounded-xl">
      {title && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
          {title}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        {items.map((item, i) => {
          const style = VARIANT_STYLES[item.variant] || VARIANT_STYLES.default
          return (
            <span
              key={i}
              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${style}`}
            >
              {item.label}
            </span>
          )
        })}
      </div>
    </div>
  )
}
