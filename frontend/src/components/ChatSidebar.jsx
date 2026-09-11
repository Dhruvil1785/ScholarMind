/**
 * components/ChatSidebar.jsx
 *
 * Left panel with:
 * - Brand + New Thread button
 * - Sampling Temperature slider control (0.0 to 1.5)
 * - Session history with turn counts and delete buttons
 * - Memory inspector button
 * - Keyboard shortcuts legend
 */
import React from 'react'
import { Plus, MessageSquare, Trash2, PanelLeftClose, Sparkles, Brain, Sliders, Command } from 'lucide-react'
import { useChatContext, Actions } from '../context/ChatContext'
import ScholarMindLogo from './ScholarMindLogo'

export default function ChatSidebar({
  isOpen,
  onToggle,
  onNewChat,
  onSelectChat,
  onDeleteChat,
  onOpenMemory,
}) {
  const { state, dispatch } = useChatContext()
  const { sessions, sessionId, temperature = 0.7 } = state

  const handleTempChange = (e) => {
    const val = parseFloat(e.target.value)
    dispatch({ type: Actions.SET_TEMPERATURE, temperature: val })
  }

  return (
    <>
      {/* Mobile backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-slate-900/30 backdrop-blur-xs z-30 md:hidden"
          onClick={onToggle}
        />
      )}

      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 flex flex-col w-64 bg-slate-100/90 dark:bg-slate-950/90
                   border-r border-slate-200/90 dark:border-slate-800/80 backdrop-blur-md transition-all duration-300 ease-in-out
                   ${isOpen ? 'translate-x-0' : '-translate-x-full md:-translate-x-full md:w-0 md:border-r-0 md:overflow-hidden'}`}
      >
        {/* Header / Brand + Close button */}
        <div className="flex items-center justify-between p-3.5 border-b border-slate-200/80 dark:border-slate-800">
          <ScholarMindLogo size="sm" showTagline={false} />

          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/70 dark:hover:bg-slate-800 transition-colors cursor-pointer"
            title="Close sidebar (⌘B)"
          >
            <PanelLeftClose className="w-4 h-4" />
          </button>
        </div>

        {/* Action Buttons: New Thread & Memory */}
        <div className="p-3 space-y-2">
          <button
            onClick={onNewChat}
            className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl
                       bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800/70 border border-slate-200/80 dark:border-slate-800 text-slate-800 dark:text-slate-100
                       text-xs font-semibold shadow-xs transition-all duration-150 active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Plus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>New Thread</span>
            </div>
            <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-slate-100 dark:bg-slate-800 text-slate-500 rounded border border-slate-200 dark:border-slate-700">⌘N</kbd>
          </button>

          {/* Temperature Slider Card */}
          <div className="p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-2xs">
            <div className="flex items-center justify-between text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              <span className="flex items-center gap-1.5 text-[11px] font-mono uppercase tracking-wider text-slate-400">
                <Sliders className="w-3 h-3" />
                Temperature
              </span>
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/60 px-1.5 py-0.2 rounded border border-blue-100 dark:border-blue-900/50">
                {temperature.toFixed(1)}
              </span>
            </div>
            <input
              type="range"
              min="0.0"
              max="1.5"
              step="0.1"
              value={temperature}
              onChange={handleTempChange}
              className="w-full accent-blue-600 cursor-pointer h-1.5 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none"
              title="Sampling Temperature (0.0 Precise - 1.5 Creative)"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0.0 Precise</span>
              <span>1.5 Creative</span>
            </div>
          </div>
        </div>

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
          <div className="px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-slate-400">
            Session History
          </div>

          {sessions.length === 0 ? (
            <div className="px-3 py-6 text-center text-xs text-slate-400">
              No conversations yet
            </div>
          ) : (
            sessions.map((sess) => {
              const isActive = sess.id === sessionId
              const turnCount = sess.messages ? Math.floor(sess.messages.length / 2) : 0
              return (
                <div
                  key={sess.id}
                  onClick={() => onSelectChat(sess.id)}
                  className={`group relative flex items-center justify-between gap-2 px-3 py-2 rounded-xl text-xs font-medium cursor-pointer transition-all duration-150 ${
                    isActive
                      ? 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border border-blue-200/80 dark:border-blue-900/60 shadow-2xs'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-900/60 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400'}`} />
                    <span className="truncate">
                      {sess.title || 'New Thread'}
                    </span>
                  </div>

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-full bg-slate-200/70 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                      {turnCount}
                    </span>

                    {/* Delete button (visible on hover or when active) */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        onDeleteChat(sess.id)
                      }}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 opacity-0 group-hover:opacity-100 transition-all cursor-pointer"
                      title="Delete thread"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        {/* Shortcuts Legend */}
        <div className="p-3 border-t border-slate-200/80 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 text-[11px] text-slate-500 dark:text-slate-400 space-y-1">
          <div className="text-[10px] font-mono uppercase tracking-wider text-slate-400 mb-1.5">Shortcuts</div>
          <div className="flex justify-between items-center">
            <span>Toggle sidebar</span>
            <kbd className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">⌘B</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>Memory inspector</span>
            <kbd className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">⌘M</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>Submit prompt</span>
            <kbd className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">↵</kbd>
          </div>
          <div className="flex justify-between items-center">
            <span>Clear dialogue</span>
            <kbd className="font-mono text-[10px] bg-slate-200/70 dark:bg-slate-800 px-1.5 py-0.5 rounded">⌘K</kbd>
          </div>
        </div>
      </aside>
    </>
  )
}
