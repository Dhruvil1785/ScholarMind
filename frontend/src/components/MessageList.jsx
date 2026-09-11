import React, { useEffect, useRef } from 'react'
import { GraduationCap, BookOpen, Lightbulb, HelpCircle, Sparkles } from 'lucide-react'
import MessageBubble from './MessageBubble'
import { ScholarMindIcon } from './ScholarMindLogo'

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
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center select-none py-10">
          {/* ScholarMind Logo Badge */}
          <div className="mb-4 transform hover:scale-105 transition-transform duration-300">
            <ScholarMindIcon size="xl" />
          </div>

          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-200/60 dark:border-indigo-800/60 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400 mb-2">
            <GraduationCap className="w-3.5 h-3.5" />
            <span>Quality Education Tutor</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-800 dark:text-slate-100 mb-1 tracking-tight">
            Welcome to <span className="text-indigo-600 dark:text-indigo-400">ScholarMind</span>
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 max-w-md mb-8">
            Your adaptive AI Learning Tutor. Ask concepts, request practice quizzes, or dive deep into educational topics at your own pace.
          </p>

          {/* Prompt suggestions grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full max-w-lg text-left">
            {[
              { icon: BookOpen, title: 'Explain a Concept', desc: 'Break down complex topics with analogies', prompt: 'Explain the concept of Neural Networks simply for a beginner.' },
              { icon: HelpCircle, title: 'Test My Knowledge', desc: 'Give 2-3 practice questions on a topic', prompt: 'Give me 3 practice questions on Photosynthesis to test my understanding.' },
              { icon: GraduationCap, title: 'Quality Education Goals', desc: 'Explore inclusive, equitable quality education', prompt: 'What are key pillars for achieving quality and equitable education globally?' },
              { icon: Lightbulb, title: 'Step-by-Step Problem Solving', desc: 'Walk me through a difficult problem', prompt: 'Help me understand calculus derivatives step-by-step.' },
            ].map((item, idx) => (
              <button
                key={idx}
                onClick={() => onSelectSuggestion && onSelectSuggestion(item.prompt)}
                className="flex items-start gap-3 p-3.5 rounded-xl border border-slate-200/80 bg-white hover:bg-slate-50
                           hover:border-indigo-200 dark:bg-slate-900 dark:border-slate-800 dark:hover:bg-slate-800/80
                           dark:hover:border-indigo-800/70 transition-all text-left shadow-xs group cursor-pointer"
              >
                <item.icon className="w-4 h-4 text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0 group-hover:scale-110 transition-transform" />
                <div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{item.title}</div>
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
