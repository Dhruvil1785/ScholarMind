/**
 * components/ToolCallIndicator.jsx
 *
 * Spec §5: inline pill "⚙ Running tool_name…" while tool runs.
 * Replaced by result once resolved.
 */
import React from 'react'
import { Cog, CheckCircle2 } from 'lucide-react'

export default function ToolCallIndicator({ toolCalls = [] }) {
  if (!toolCalls.length) return null

  return (
    <div className="flex flex-col gap-1 mb-2">
      {toolCalls.map((tc) => (
        <div key={tc.id} className="tool-pill animate-fade-in">
          {tc.status === 'running' ? (
            <>
              <Cog className="w-3 h-3 animate-spin" />
              <span>Running <span className="font-mono">{tc.name}</span>…</span>
            </>
          ) : (
            <>
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span className="text-emerald-400">
                <span className="font-mono">{tc.name}</span> done
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  )
}
