/**
 * components/MessageBubble.jsx
 *
 * Renders distinct User (person) and Assistant (agent) message layouts:
 * - Proper avatars on both sides (User on right, Gemini/Agent on left)
 * - Light-mode typography & markdown support
 * - Code syntax container with copy-to-clipboard button
 * - Tool calls & Generative UI integration
 */
import React, { useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { User, Sparkles, Copy, Check } from 'lucide-react'
import ToolCallIndicator from './ToolCallIndicator'
import GenerativeUICard from './GenerativeUICard'

export default function MessageBubble({ message }) {
  const { role, content, status, toolCalls, uiCard } = message
  const isUser = role === 'user'
  const isStreaming = status === 'streaming'
  const [copied, setCopied] = useState(false)

  const handleCopy = () => {
    if (!content) return
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div
      className={`group flex gap-3 mb-6 animate-slide-up ${
        isUser ? 'flex-row-reverse items-start' : 'flex-row items-start'
      }`}
    >
      {/* Avatar */}
      <div
        className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm text-xs font-semibold ${
          isUser
            ? 'bg-blue-600 text-white shadow-blue-500/20'
            : 'bg-white border border-slate-200 text-blue-600 shadow-slate-200/50 dark:bg-slate-800 dark:border-slate-700 dark:text-blue-400 dark:shadow-none'
        }`}
      >
        {isUser ? <User className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-blue-600 dark:text-blue-400" />}
      </div>

      {/* Message Content Container */}
      <div className={`flex flex-col max-w-[82%] sm:max-w-[75%] ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Role label & timestamp */}
        <div className="flex items-center gap-2 mb-1 px-1">
          <span className="text-[11px] font-medium text-slate-400 dark:text-slate-500">
            {isUser ? 'You' : 'Assistant'}
          </span>
        </div>

        {/* Tool calls (above assistant bubble) */}
        {!isUser && <ToolCallIndicator toolCalls={toolCalls} />}

        {/* Bubble */}
        <div
          className={`relative px-4 py-3 text-sm leading-relaxed rounded-2xl shadow-sm transition-all ${
            isUser
              ? 'bg-blue-600 text-white rounded-tr-xs shadow-blue-500/10'
              : 'bg-white border border-slate-200/90 text-slate-800 rounded-tl-xs shadow-slate-200/40 dark:bg-slate-800/90 dark:border-slate-700/80 dark:text-slate-100 dark:shadow-none'
          }`}
        >
          {isUser ? (
            <p className="whitespace-pre-wrap break-words">{content}</p>
          ) : (
            <div className={`prose prose-sm max-w-none text-slate-800 dark:text-slate-100 dark:prose-invert ${isStreaming ? 'streaming-cursor' : ''}`}>
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code({ node, inline, className, children, ...props }) {
                    const match = /language-(\w+)/.exec(className || '')
                    return !inline ? (
                      <div className="my-2 rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-900 text-slate-100 shadow-sm">
                        <div className="flex items-center justify-between px-3 py-1.5 bg-slate-800/90 text-[11px] font-mono text-slate-400 border-b border-slate-700/50">
                          <span>{match ? match[1] : 'code'}</span>
                          <button
                            onClick={() => navigator.clipboard.writeText(String(children))}
                            className="hover:text-white transition-colors flex items-center gap-1"
                          >
                            <Copy className="w-3 h-3" />
                            <span>Copy</span>
                          </button>
                        </div>
                        <pre className="p-3 text-xs overflow-x-auto font-mono leading-relaxed bg-slate-900">
                          <code className={className} {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    ) : (
                      <code className="px-1.5 py-0.5 rounded-md bg-slate-100 text-blue-700 dark:bg-slate-700 dark:text-blue-300 font-mono text-xs" {...props}>
                        {children}
                      </code>
                    )
                  },
                  p({ children }) {
                    return <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>
                  },
                  ul({ children }) {
                    return <ul className="list-disc list-inside space-y-1 my-2">{children}</ul>
                  },
                  ol({ children }) {
                    return <ol className="list-decimal list-inside space-y-1 my-2">{children}</ol>
                  },
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          )}

          {/* Copy bubble action for assistant */}
          {!isUser && !isStreaming && content && (
            <button
              onClick={handleCopy}
              className="absolute -bottom-7 left-1 p-1 rounded-md text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-[11px]"
              title="Copy message"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" />
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">Copied</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3" />
                  <span>Copy</span>
                </>
              )}
            </button>
          )}
        </div>

        {/* Generative UI card below assistant bubble */}
        {!isUser && uiCard && (
          <div className="mt-3 w-full max-w-lg animate-fade-in">
            <GenerativeUICard type={uiCard.type} data={uiCard.data} />
          </div>
        )}
      </div>
    </div>
  )
}
