/**
 * components/SessionHeader.jsx
 *
 * Header with sidebar toggle, active thread title, 3-way theme switcher (Auto/Light/Dark),
 * Memory inspector button, and connection status.
 * Note: Model selection is intentionally located inside the chatbox, NOT in this header.
 */
import React from 'react'
import { RotateCcw, PanelLeft, Brain, Monitor, Sun, Moon } from 'lucide-react'
import { useChatContext, Actions } from '../context/ChatContext'

const STATUS_LABELS = {
  open:       'Connected',
  connecting: 'Connecting…',
  closed:     'Disconnected',
  error:      'Error',
}

export default function SessionHeader({
  connectionStatus,
  onReset,
  sidebarOpen,
  onToggleSidebar,
  onOpenMemory,
}) {
  const { state, dispatch } = useChatContext()
  const activeSession = state.sessions.find(s => s.id === state.sessionId)
  const threadTitle = activeSession?.title || 'Conversational Workspace'
  const currentTheme = state.theme || 'system'

  const setTheme = (theme) => {
    dispatch({ type: Actions.SET_THEME, theme })
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between px-4 py-3 border-b border-slate-200/80 dark:border-slate-800 bg-white/90 dark:bg-slate-950/90 backdrop-blur-md transition-colors">
      {/* Left: Sidebar toggle + Thread Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          id="btn-toggle-sidebar"
          onClick={onToggleSidebar}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          title={sidebarOpen ? "Close sidebar (⌘B)" : "Open sidebar (⌘B)"}
          aria-label="Toggle Sidebar"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        <div className="min-w-0">
          <h1 className="text-sm font-semibold text-slate-800 dark:text-slate-100 leading-tight truncate max-w-xs sm:max-w-md">
            {threadTitle}
          </h1>
          <p className="text-[11px] text-slate-400 dark:text-slate-500 leading-tight">
            NextGen AI · 3-Tier Grounded Architecture
          </p>
        </div>
      </div>

      {/* Right: Theme Switcher + Memory button + Connection status + Clear */}
      <div className="flex items-center gap-2 sm:gap-2.5 flex-shrink-0">
        {/* 3-Way Theme Switcher (System / Light / Dark) */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setTheme('system')}
            title="Auto (System Theme)"
            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              currentTheme === 'system'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme('light')}
            title="Light Theme"
            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              currentTheme === 'light'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setTheme('dark')}
            title="Dark Theme"
            className={`p-1.5 rounded-lg text-xs transition-all cursor-pointer ${
              currentTheme === 'dark'
                ? 'bg-white dark:bg-slate-800 text-blue-600 dark:text-blue-400 shadow-xs font-semibold'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
            }`}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Working Memory Inspector button */}
        <button
          onClick={onOpenMemory}
          title="Inspect Working & Episodic Memory (⌘M)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-700 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white bg-slate-100/90 dark:bg-slate-800/90 hover:bg-slate-200/80 dark:hover:bg-slate-700/80 border border-slate-200/80 dark:border-slate-700 transition-all active:scale-95 cursor-pointer"
        >
          <Brain className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
          <span className="font-medium hidden sm:inline">Memory</span>
        </button>

        {/* Connection status */}
        <div
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-50 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800"
          title={STATUS_LABELS[connectionStatus]}
        >
          <span className={`status-dot status-dot-${connectionStatus}`} />
          <span className="text-[11px] font-medium text-slate-600 dark:text-slate-300 hidden md:inline">
            {STATUS_LABELS[connectionStatus]}
          </span>
        </div>

        {/* Reset conversation */}
        <button
          id="reset-session-btn"
          onClick={onReset}
          title="Clear current dialogue (⌘K)"
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline font-medium">Clear</span>
        </button>
      </div>
    </header>
  )
}
