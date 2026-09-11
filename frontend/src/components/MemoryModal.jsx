/**
 * components/MemoryModal.jsx
 *
 * Inspector modal for 3-Tier Memory Architecture:
 * - Tier 1: Working Memory sliding window turns & token budget progress
 * - Tier 3: Episodic learned facts for the active session
 * - Document Ingestion: Upload file (.txt, .md, .csv) & ingest data/goal_materials/
 */
import React, { useState, useEffect, useCallback } from 'react'
import { Brain, X, RefreshCw, Layers, ShieldCheck, Upload, FolderUp, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function MemoryModal({ isOpen, onClose, sessionId }) {
  const [turns, setTurns] = useState([])
  const [facts, setFacts] = useState([])
  const [tokenUsage, setTokenUsage] = useState(0)
  const [loading, setLoading] = useState(false)
  const [ingestStatus, setIngestStatus] = useState('')
  const [activeTab, setActiveTab] = useState('turns') // 'turns' | 'facts' | 'ingest'

  const fetchMemory = useCallback(async () => {
    if (!sessionId) return
    setLoading(true)
    try {
      const res = await fetch(`/api/session/${sessionId}/memory`)
      if (res.ok) {
        const data = await res.json()
        setTurns(data.turns || [])
        setFacts(data.facts || [])
        setTokenUsage(data.token_count || (data.turns ? data.turns.length * 150 : 0))
      }
    } catch (_) {
      // Non-critical
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    if (isOpen) {
      fetchMemory()
    }
  }, [isOpen, fetchMemory])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  const handleClearMemory = async () => {
    if (!sessionId) return
    if (window.confirm('Clear working memory turns for this session?')) {
      try {
        await fetch(`/api/session/${sessionId}`, { method: 'DELETE' })
        fetchMemory()
      } catch (e) {
        console.error('Failed to clear memory:', e)
      }
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setIngestStatus('Uploading and chunking document…')
    const formData = new FormData()
    formData.append('file', file)
    formData.append('files', file)
    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const count = data.chunks_ingested ?? data.chunks ?? data.chunk_count ?? 1
        setIngestStatus(`✓ Successfully ingested "${file.name}" (${count} chunks indexed in vector store).`)
      } else {
        setIngestStatus(`⚠️ Ingestion failed: ${data.detail || res.statusText || 'Bad Request'}`)
      }
    } catch (err) {
      setIngestStatus(`Error: ${err.message}`)
    } finally {
      // Reset input value so user can upload another or same file
      e.target.value = ''
    }
  }

  const handleIngestDir = async () => {
    setIngestStatus('Scanning and indexing data/goal_materials/…')
    try {
      const res = await fetch('/api/ingest/dir', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        const count = data.chunks_ingested ?? data.total_chunks ?? data.chunks_indexed ?? 0
        setIngestStatus(`✓ Directory indexed: ${count} semantic chunks added to vector memory.`)
      } else {
        setIngestStatus(`⚠️ Ingestion failed: ${data.detail || res.statusText || 'Bad Request'}`)
      }
    } catch (err) {
      setIngestStatus(`Error: ${err.message}`)
    }
  }

  if (!isOpen) return null

  const TOKEN_BUDGET = 3000
  const tokenPercent = Math.min(Math.round((tokenUsage / TOKEN_BUDGET) * 100), 100)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 dark:bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-2xs">
              <Brain className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">3-Tier Memory & Knowledge Inspector</h3>
                <span className="px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/60 text-blue-700 dark:text-blue-400 text-[10px] font-mono font-bold">
                  Tier 1 & 3
                </span>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono truncate max-w-[320px]">
                Session: {sessionId || 'No session active'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={fetchMemory}
              disabled={loading}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Refresh telemetry"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close (Esc)"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Token Usage Telemetry Bar */}
        <div className="px-5 py-3 bg-slate-50/50 dark:bg-slate-950/30 border-b border-slate-100 dark:border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 mb-1.5 font-mono">
            <span>Working Memory Token Budget</span>
            <span className="font-semibold text-blue-600 dark:text-blue-400">{tokenUsage} / {TOKEN_BUDGET} tokens ({tokenPercent}%)</span>
          </div>
          <div className="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-300 ${tokenPercent > 80 ? 'bg-amber-500' : 'bg-blue-600 dark:bg-blue-500'}`}
              style={{ width: `${tokenPercent}%` }}
            />
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 dark:border-slate-800 px-5 pt-2 gap-4 text-xs font-medium">
          <button
            onClick={() => setActiveTab('turns')}
            className={`pb-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'turns'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Working Turns ({turns.length})
          </button>
          <button
            onClick={() => setActiveTab('facts')}
            className={`pb-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'facts'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Learned Facts ({facts.length})
          </button>
          <button
            onClick={() => setActiveTab('ingest')}
            className={`pb-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'ingest'
                ? 'border-blue-600 text-blue-600 dark:text-blue-400 font-semibold'
                : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
            }`}
          >
            Document Ingestion
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {activeTab === 'turns' && (
            <div className="space-y-3">
              {turns.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 font-mono">
                  No turns in working memory yet. Send a prompt to start dialogue.
                </div>
              ) : (
                turns.map((t, idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-slate-400 mb-1">
                      <span className="uppercase font-bold text-blue-600 dark:text-blue-400">{t.role}</span>
                      <span>Turn #{idx + 1}</span>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 font-sans leading-relaxed break-words whitespace-pre-wrap">
                      {t.content}
                    </p>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'facts' && (
            <div className="space-y-2">
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Episodic facts automatically learned during conversation and indexed into session ChromaDB:
              </p>
              {facts.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-400 font-mono">
                  No episodic facts learned for this session yet.
                </div>
              ) : (
                facts.map((fact, idx) => (
                  <div key={idx} className="flex items-start gap-2 p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 flex-shrink-0" />
                    <span>{typeof fact === 'string' ? fact : fact.text || JSON.stringify(fact)}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'ingest' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
                <h4 className="text-xs font-semibold text-slate-800 dark:text-slate-200">Semantic Document Ingestion</h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                  Upload markdown, text, or CSV files to index into ChromaDB knowledge collection:
                </p>

                <div className="flex flex-wrap items-center gap-3">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium cursor-pointer shadow-xs active:scale-95 transition-all">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Upload & Ingest Document</span>
                    <input type="file" accept=".md,.txt,.csv" onChange={handleFileUpload} className="hidden" />
                  </label>

                  <button
                    onClick={handleIngestDir}
                    className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 text-xs font-medium cursor-pointer border border-slate-200 dark:border-slate-700 active:scale-95 transition-all"
                  >
                    <FolderUp className="w-3.5 h-3.5" />
                    <span>Ingest 'data/goal_materials/'</span>
                  </button>
                </div>

                {ingestStatus && (
                  <div className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono text-slate-700 dark:text-slate-300">
                    {ingestStatus}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/70">
          <button
            onClick={handleClearMemory}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 border border-rose-200 dark:border-rose-900/50 transition-all cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear Session Turns</span>
          </button>

          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 dark:bg-slate-100 text-white dark:text-slate-900 text-xs font-semibold hover:bg-slate-900 dark:hover:bg-white shadow-2xs transition-all cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
