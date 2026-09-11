/**
 * App.jsx — Root component.
 *
 * Layout:
 * <App>
 *  └─ <ChatProvider>
 *      └─ <ChatLayout>
 *          ├─ <ChatSidebar />
 *          └─ Main Chat Container
 *              ├─ <SessionHeader />
 *              ├─ <MessageList />
 *              ├─ <InputBar />
 *              └─ <MemoryModal />
 */
import React, { useState, useCallback, useEffect } from 'react'
import { ChatProvider, useChatContext, Actions } from './context/ChatContext'
import { useChatSocket } from './hooks/useChatSocket'
import ChatSidebar from './components/ChatSidebar'
import SessionHeader from './components/SessionHeader'
import MessageList from './components/MessageList'
import MemoryModal from './components/MemoryModal'
import InputBar from './components/InputBar'

// ── REST chat via POST /chat (hackathon judging path) ────────────────────────
function useRestChat() {
  const { state, dispatch, newId } = useChatContext()
  const [isGenerating, setIsGenerating] = useState(false)
  // Persistent session_id so multi-turn history works across sends
  const sessionRef = React.useRef(state.sessionId || newId())

  const sendMessage = useCallback(async (text) => {
    if (!text || isGenerating) return

    const userMsgId = newId()
    const asstMsgId = newId()

    // Optimistically add the user bubble
    dispatch({
      type: Actions.ADD_MESSAGE,
      message: { id: userMsgId, role: 'user', content: text, status: 'done' },
    })
    // Add placeholder assistant bubble
    dispatch({
      type: Actions.ADD_MESSAGE,
      message: { id: asstMsgId, role: 'assistant', content: '', status: 'streaming' },
    })

    setIsGenerating(true)
    try {
      const res = await fetch('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          session_id: sessionRef.current,
          model: state.model || 'gemini-3.1-flash-lite',
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        throw new Error(`HTTP ${res.status}: ${err}`)
      }
      const data = await res.json()
      // Store the session_id the server assigned (in case it was ephemeral)
      sessionRef.current = data.session_id

      dispatch({
        type: Actions.UPDATE_MESSAGE,
        id: asstMsgId,
        patch: { content: data.response, status: 'done' },
      })
    } catch (err) {
      console.error('POST /chat error:', err)
      dispatch({
        type: Actions.UPDATE_MESSAGE,
        id: asstMsgId,
        patch: { content: `⚠️ Error: ${err.message}`, status: 'error' },
      })
    } finally {
      setIsGenerating(false)
    }
  }, [isGenerating, dispatch, newId])

  return { isGenerating, sendMessage }
}

function ChatLayout() {
  const { state, dispatch } = useChatContext()
  // WebSocket hook — keeps WS working for the full streaming demo path
  const {
    connectionStatus,
    isGenerating: wsGenerating,
    sendMessage: wsSendMessage,
    createNewChat,
    switchChat,
    deleteChat,
    resetSession,
  } = useChatSocket()

  // REST hook — mandatory judging path
  const { isGenerating: restGenerating, sendMessage: restSendMessage } = useRestChat()

  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [memoryModalOpen, setMemoryModalOpen] = useState(false)

  // Use REST as primary send for reliability; WS streaming is still active
  const sendMessage = restSendMessage
  const isGenerating = restGenerating || wsGenerating
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
      {/* History & Controls Sidebar */}
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
          disabled={isBusy}
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
