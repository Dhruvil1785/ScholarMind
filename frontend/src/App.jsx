/**
 * App.jsx — Root component.
 *
 * Layout:
 * <App>
 *  └─ <ChatProvider>
 *      └─ <ChatLayout>
 *          ├─ <ChatSidebar /> (past conversations, temperature slider, memory button)
 *          └─ Main Chat Container
 *              ├─ <SessionHeader /> (thread title, 3-way theme switcher, clear)
 *              ├─ <MessageList /> (streaming messages, markdown, tool calls, GenUI widgets)
 *              ├─ <InputBar /> (embedded model popover dropdown, send button)
 *              └─ <MemoryModal /> (popup 3-tier memory inspector & ingestion)
 */
import React, { useState, useEffect } from 'react'
import { ChatProvider, useChatContext, Actions } from './context/ChatContext'
import { useChatSocket } from './hooks/useChatSocket'
import ChatSidebar from './components/ChatSidebar'
import SessionHeader from './components/SessionHeader'
import MessageList from './components/MessageList'
import MemoryModal from './components/MemoryModal'
import InputBar from './components/InputBar'

function ChatLayout() {
  const { state, dispatch } = useChatContext()
  const {
    connectionStatus,
    isGenerating,
    sendMessage,
    createNewChat,
    switchChat,
    deleteChat,
    resetSession,
  } = useChatSocket()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [memoryModalOpen, setMemoryModalOpen] = useState(false)

  const isStreaming = state.messages.some((m) => m.status === 'streaming')
  const isBusy = isGenerating || isStreaming

  // Global Keyboard Shortcuts (⌘B, ⌘M, ⌘K, ⌘D)
  useEffect(() => {
    const handleGlobalShortcuts = (e) => {
      const isMod = e.metaKey || e.ctrlKey
      if (!isMod) return

      if (e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSidebarOpen((prev) => !prev)
      } else if (e.key.toLowerCase() === 'm') {
        e.preventDefault()
        setMemoryModalOpen((prev) => !prev)
      } else if (e.key.toLowerCase() === 'k') {
        e.preventDefault()
        resetSession()
      } else if (e.key.toLowerCase() === 'd') {
        e.preventDefault()
        const themes = ['system', 'light', 'dark']
        const nextIdx = (themes.indexOf(state.theme || 'system') + 1) % themes.length
        dispatch({ type: Actions.SET_THEME, theme: themes[nextIdx] })
      }
    }
    window.addEventListener('keydown', handleGlobalShortcuts)
    return () => window.removeEventListener('keydown', handleGlobalShortcuts)
  }, [resetSession, state.theme, dispatch])

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans antialiased transition-colors duration-200">
      {/* ChatGPT-style History & Controls Sidebar */}
      <ChatSidebar
        isOpen={sidebarOpen}
        onToggle={() => setSidebarOpen((prev) => !prev)}
        onNewChat={createNewChat}
        onSelectChat={switchChat}
        onDeleteChat={deleteChat}
        onOpenMemory={() => setMemoryModalOpen(true)}
      />

      {/* Main Chat View */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-slate-50/50 dark:bg-slate-950/50">
        <SessionHeader
          connectionStatus={connectionStatus}
          onReset={resetSession}
          sidebarOpen={sidebarOpen}
          onToggleSidebar={() => setSidebarOpen((prev) => !prev)}
          onOpenMemory={() => setMemoryModalOpen(true)}
        />

        <MessageList
          messages={state.messages}
          onSelectSuggestion={(prompt) => !isBusy && sendMessage(prompt)}
        />

        <InputBar
          onSend={sendMessage}
          disabled={isBusy || connectionStatus !== 'open'}
        />

        {/* Working & Long-Term Memory Modal Popup */}
        <MemoryModal
          isOpen={memoryModalOpen}
          onClose={() => setMemoryModalOpen(false)}
          sessionId={state.sessionId}
        />
      </div>
    </div>
  )
}

export default function App() {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  )
}
