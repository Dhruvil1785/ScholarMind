/**
 * components/MessageList.jsx
 *
 * Scrollable list of MessageBubbles in light theme with prompt suggestions.
 */
import React, { useEffect, useRef } from 'react'
import { Sparkles, Compass, Lightbulb, MessageCircle } from 'lucide-react'
import MessageBubble from './MessageBubble'

export default function MessageList({ messages, onSelectSuggestion }) {
  const bottomRef = useRef(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  return (
    <div
      id="message-list"
      className="flex-1 overflow-y-auto py-6 px-4 md:px-6 w-full max-w-3xl mx-auto"
    >
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center select-none py-12">
          {/* Sparkle badge */}
          <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900/50 flex items-center justify-center mb-4 shadow-sm">
            <Sparkles className="w-7 h-7 text-blue-600 dark:text-blue-400" />
          </div>

          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-100 mb-1">
            How can I help you today?
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mb-8">
            Grounded in your topic materials with multi-tier conversational memory.
          </p>

          {/* Prompt suggestions grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-md text-left">
            {[
              { icon: Compass, title: 'Explore Topic Guidelines', desc: 'Summarize the core requirements' },
              { icon: Lightbulb, title: 'Brainstorm Ideas', desc: 'Generate potential project solutions' },
              { icon: MessageCircle, title: 'Ask Questions', desc: 'Clarify any rules or materials' },
              { icon: Sparkles, title: 'Check Memory', desc: 'Recall my project details and facts' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion && onSelectSuggestion(item.title)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50
                           hover:border-slate-300 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/80
                           dark:hover:border-slate-700 transition-all text-left shadow-sm group"
              >
                <item.icon className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200">{item.title}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">{item.desc}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {messages.map((msg) => (
        <MessageBubble key={msg.id} message={msg} />
      ))}

      {/* Scroll anchor */}
      <div ref={bottomRef} />
    </div>
  )
}
