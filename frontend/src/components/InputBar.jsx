/**
 * components/InputBar.jsx
 *
 * Floating chat composer with embedded model selection popover dropdown:
 * - Enter to send, Shift+Enter for newline
 * - Auto-expanding textarea
 * - Custom model selector popover (Fast, Hybrid, Pro) with checkmarks
 * - Disabled state while streaming
 */
import React, { useState, useRef, useCallback, useEffect } from 'react'
import { ArrowUp, Loader2, Sparkles, ChevronDown, Check } from 'lucide-react'
import { useChatContext, Actions } from '../context/ChatContext'

const MODELS = [
  {
    id: 'gemini-3.1-flash-lite',
    name: 'Gemini 3.1 Flash Lite',
    badge: 'Ultra Fast',
    badgeColor: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
    desc: 'Lightweight, ultra-low latency & responsive reasoning',
  },
  {
    id: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    badge: 'Fast',
    badgeColor: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
    desc: 'High-speed multimodal reasoning & interactive dialogue',
  },
  {
    id: 'gemini-3.7-flash',
    name: 'Gemini 3.7 Flash',
    badge: 'Hybrid',
    badgeColor: 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20',
    desc: 'State-of-the-art multimodal reasoning with thinking depth',
  },
]

export default function InputBar({ onSend, disabled = false }) {
  const { state, dispatch } = useChatContext()
  const [text, setText] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const textareaRef = useRef(null)
  const menuRef = useRef(null)

  const activeModelId = state.model || 'gemini-3.1-flash-lite'
  const activeModel = MODELS.find((m) => m.id === activeModelId) || MODELS[0]

  const handleSend = useCallback(() => {
    const trimmed = text.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setText('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [text, disabled, onSend])

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleChange = (e) => {
    setText(e.target.value)
    const ta = e.target
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 180) + 'px'
  }

  // Dismiss dropdown on outside click or Escape
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false)
      }
    }
    const handleKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      document.addEventListener('keydown', handleKey)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [menuOpen])

  const selectModel = (modelId) => {
    dispatch({ type: Actions.SET_MODEL, model: modelId })
    setMenuOpen(false)
  }

  const canSend = !disabled && text.trim().length > 0

  return (
    <div className="w-full pb-4 pt-1 transition-colors bg-transparent">
      <div className="w-full max-w-3xl mx-auto px-4">
        {/* Floating rounded card form */}
        <div className="relative flex flex-col p-3 rounded-2xl sm:rounded-3xl bg-white dark:bg-slate-900 border border-slate-200/90 dark:border-slate-800 shadow-md shadow-slate-200/40 dark:shadow-black/40 focus-within:border-indigo-400 dark:focus-within:border-indigo-500/60 focus-within:ring-2 focus-within:ring-indigo-500/10 transition-all duration-150">
          
          {/* Textarea */}
          <textarea
            id="chat-input"
            ref={textareaRef}
            value={text}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            placeholder={disabled ? 'ScholarMind is thinking…' : 'Message ScholarMind…'}
            rows={1}
            className="w-full bg-transparent border-none text-slate-800 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 text-sm px-2 py-1 focus:outline-none resize-none leading-relaxed max-h-40 min-h-[38px]"
          />

          {/* Bottom Actions Bar — seamless, no partition line */}
          <div className="flex items-center justify-between pt-2">
            {/* Left: Embedded Custom Model Selector */}
            <div className="relative" ref={menuRef}>
              <button
                type="button"
                id="model-picker-trigger"
                onClick={() => setMenuOpen((prev) => !prev)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer select-none ${
                  menuOpen
                    ? 'bg-white dark:bg-slate-800 border-blue-500 dark:border-blue-400 text-blue-600 dark:text-blue-400 shadow-xs'
                    : 'bg-white/80 dark:bg-slate-800/80 hover:bg-white dark:hover:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                }`}
                title="Select AI Model"
                aria-haspopup="listbox"
                aria-expanded={menuOpen}
              >
                <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-blue-400 flex-shrink-0" />
                <span>{activeModel.name}</span>
                <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-150 ${menuOpen ? 'rotate-180 text-blue-500' : ''}`} />
              </button>

              {/* Animated Popover Menu */}
              {menuOpen && (
                <div
                  className="absolute bottom-full left-0 mb-2 w-80 p-1.5 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl dark:shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
                  role="listbox"
                  aria-label="Inference Models"
                >
                  <div className="flex items-center justify-between px-3 py-2 border-b border-slate-100 dark:border-slate-800/80 mb-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    <span>Inference Model</span>
                    <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 font-sans font-semibold">Google GenAI</span>
                  </div>

                  <div className="space-y-1">
                    {MODELS.map((m) => {
                      const isSelected = m.id === activeModelId
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => selectModel(m.id)}
                          className={`w-full flex items-start justify-between gap-3 p-2.5 rounded-xl text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/70 dark:bg-blue-950/40 border border-blue-200/80 dark:border-blue-900/60'
                              : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 border border-transparent'
                          }`}
                          role="option"
                          aria-selected={isSelected}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-semibold ${isSelected ? 'text-blue-900 dark:text-blue-200' : 'text-slate-800 dark:text-slate-200'}`}>
                                {m.name}
                              </span>
                              <span className={`text-[9px] font-mono uppercase font-bold px-1.5 py-0.5 rounded border ${m.badgeColor}`}>
                                {m.badge}
                              </span>
                            </div>
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
                              {m.desc}
                            </p>
                          </div>

                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0 mt-0.5">
                            {isSelected && (
                              <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 stroke-[2.5]" />
                            )}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Hint + Dispatch Button */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-[11px] text-slate-400 dark:text-slate-500">
                ↵ to send
              </span>

              <button
                id="send-btn"
                onClick={handleSend}
                disabled={!canSend}
                className={`h-8 px-3 rounded-xl flex items-center gap-1.5 text-xs font-medium transition-all duration-150 flex-shrink-0 ${
                  canSend
                    ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-500/20 active:scale-95 cursor-pointer'
                    : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-600 cursor-not-allowed'
                }`}
                aria-label="Send message"
              >
                {disabled ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 text-slate-400 animate-spin" />
                    <span>Thinking</span>
                  </>
                ) : (
                  <>
                    <span>Dispatch</span>
                    <ArrowUp className="w-3.5 h-3.5 stroke-[2.5]" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between text-[11px] text-slate-400 dark:text-slate-500 mt-2 px-1">
          <span>Shift+Enter for newline</span>
          <span>Quality Education · Adaptive AI Tutor</span>
        </div>
      </div>
    </div>
  )
}
