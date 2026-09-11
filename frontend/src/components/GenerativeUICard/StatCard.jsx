/**
 * components/GenerativeUICard/StatCard.jsx
 *
 * Renders a single stat for light theme.
 */
import React from 'react'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'

export default function StatCard({ data }) {
  const { label, value, delta, unit } = data

  const deltaNum = delta ? parseFloat(delta) : null
  const DeltaIcon = deltaNum > 0 ? TrendingUp : deltaNum < 0 ? TrendingDown : Minus
  const deltaColor = deltaNum > 0
    ? 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/40'
    : deltaNum < 0
    ? 'text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/40'
    : 'text-slate-500 bg-slate-100 dark:text-slate-400 dark:bg-slate-800'

  return (
    <div className="glass-card p-4 min-w-[160px] bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-sm rounded-xl">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mb-1">
        {label}
      </p>
      <div className="flex items-end gap-2">
        <span className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {value}{unit && <span className="text-sm text-slate-500 dark:text-slate-400 ml-1">{unit}</span>}
        </span>
        {deltaNum !== null && (
          <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${deltaColor}`}>
            <DeltaIcon className="w-3.5 h-3.5" />
            <span>{Math.abs(deltaNum)}%</span>
          </div>
        )}
      </div>
    </div>
  )
}
