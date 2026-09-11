/**
 * components/MemoryDrawer.jsx
 *
 * Light-theme collapsible drawer displaying Tier 1 working memory turns.
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Brain, ChevronDown, ChevronUp, RefreshCw } from 'lucide-react'

export default function MemoryDrawer({ sessionId }) {
  const [isOpen, setIsOpen] = useState(false)
  const [turns, setTurns] = useState([])
  const [loading, setLoading] = useState(false)

  const fetchMemory = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/memory`)
      if (!res.ok) return
      const data = await res.json()
      setTurns(data.turns || [])
    } catch (_) {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (isOpen) fetchMemory()
  }, [isOpen, fetchMemory])

  return (
    <div className="border-t border-slate-200/80 bg-slate-50/70">
      {/* Toggle header */}
      <button
        id="memory-drawer-toggle"
        onClick={() => setIsOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-slate-500 hover:text-slate-800 hover:bg-slate-100/70 transition-colors"
      >
        <div className="flex items-center gap-1.5">
          <Brain className="w-3.5 h-3.5 text-blue-600" />
          <span className="font-medium">Working Memory (Tier 1)</span>
          {turns.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full bg-blue-100 text-blue-700 text-[10px] font-semibold">
              {turns.length}
            </span>
          )}
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
      </button>

      {/* Drawer body */}
      {isOpen && (
        <div className="px-4 pb-3 max-h-44 overflow-y-auto">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">
              Recent sliding window turns
            </p>
            <button
              onClick={fetchMemory}
              disabled={loading}
              className="text-slate-400 hover:text-slate-600 transition-colors p-1"
              title="Refresh memory"
            >
              <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          {turns.length === 0 ? (
            <p className="text-xs text-slate-400 italic">No turns stored in memory for this session yet.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {turns.map((t, i) => (
                <div key={i} className="flex gap-2 text-xs p-1.5 rounded-lg bg-white border border-slate-200/60 shadow-sm">
                  <span className={`font-mono font-medium flex-shrink-0 w-16 truncate ${
                    t.role === 'user' ? 'text-blue-600' : 'text-emerald-600'
                  }`}>
                    {t.role}
                  </span>
                  <span className="text-slate-600 truncate">{t.content}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
