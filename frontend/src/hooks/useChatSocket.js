/**
 * hooks/useChatSocket.js
 *
 * WebSocket hook with multi-session / chat history support:
 *  - Opens /ws/chat
 *  - Session-isolated streaming: messages are routed strictly by msg.session_id
 *  - Per-session generation lock: prevents cross-session mixing and double-sends
 *  - Auto-reconnect with exponential backoff
 */
import { useEffect, useRef, useCallback, useState } from 'react'
import { useChatContext, Actions } from '../context/ChatContext'

const WS_URL = '/ws/chat'           // proxied by Vite to ws://localhost:8000
const MAX_RECONNECT_DELAY = 30_000  // cap at 30 s
const INITIAL_RECONNECT_DELAY = 500

export function useChatSocket() {
  const { state, dispatch, newId } = useChatContext()
  const { sessionId } = state

  const [isGenerating, setIsGenerating] = useState(false)
  const generatingSessions = useRef(new Set())
  const activeMsgIds = useRef({}) // { [sessionId]: messageId }

  const wsRef = useRef(null)
  const reconnectDelay = useRef(INITIAL_RECONNECT_DELAY)
  const reconnectTimer = useRef(null)
  const isMounted = useRef(true)

  // Helper to sync isGenerating state for the currently active tab
  const syncGeneratingState = useCallback((currentSid) => {
    const active = generatingSessions.current.has(currentSid)
    setIsGenerating(active)
  }, [])

  // ── Session creation ────────────────────────────────────────────────────────
  const ensureSession = useCallback(async () => {
    if (sessionId) return sessionId
    try {
      const res = await fetch('/api/session', { method: 'POST' })
      const data = await res.json()
      dispatch({ type: Actions.SET_SESSION, sessionId: data.session_id })
      return data.session_id
    } catch (err) {
      console.error('Failed to create session:', err)
      return null
    }
  }, [sessionId, dispatch])

  // ── Connect ─────────────────────────────────────────────────────────────────
  const connect = useCallback(async (targetSid = null) => {
    if (!isMounted.current) return
    const sid = targetSid || (await ensureSession())
    if (!sid) return

    dispatch({ type: Actions.SET_CONNECTION, status: 'connecting' })

    const ws = new WebSocket(`${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}${WS_URL}`)
    wsRef.current = ws

    ws.onopen = () => {
      if (!isMounted.current) return
      reconnectDelay.current = INITIAL_RECONNECT_DELAY
      dispatch({ type: Actions.SET_CONNECTION, status: 'open' })
      ws.send(JSON.stringify({ type: 'init', session_id: sid }))
    }

    ws.onmessage = (event) => {
      if (!isMounted.current) return
      let msg
      try { msg = JSON.parse(event.data) } catch { return }
      handleServerEvent(msg)
    }

    ws.onerror = () => {
      if (!isMounted.current) return
      generatingSessions.current.clear()
      syncGeneratingState(sessionId)
      dispatch({ type: Actions.SET_CONNECTION, status: 'error' })
    }

    ws.onclose = () => {
      if (!isMounted.current) return
      generatingSessions.current.clear()
      syncGeneratingState(sessionId)
      dispatch({ type: Actions.SET_CONNECTION, status: 'closed' })
      scheduleReconnect(sid)
    }
  }, [ensureSession, dispatch, sessionId, syncGeneratingState])

  // ── Reconnect with backoff ──────────────────────────────────────────────────
  const scheduleReconnect = useCallback((sid) => {
    if (!isMounted.current) return
    clearTimeout(reconnectTimer.current)
    reconnectTimer.current = setTimeout(() => {
      reconnectDelay.current = Math.min(
        reconnectDelay.current * 2,
        MAX_RECONNECT_DELAY
      )
      connect(sid)
    }, reconnectDelay.current)
  }, [connect])

  // ── Handle server events ────────────────────────────────────────────────────
  const handleServerEvent = useCallback((msg) => {
    const sid = msg.session_id || sessionId

    switch (msg.type) {

      case 'init_ack':
        break

      case 'text_delta': {
        if (!activeMsgIds.current[sid]) {
          const id = newId()
          activeMsgIds.current[sid] = id
          dispatch({
            type: Actions.ADD_MESSAGE,
            sessionId: sid,
            message: {
              id,
              role: 'assistant',
              content: msg.delta,
              status: 'streaming',
              toolCalls: [],
            },
          })
        } else {
          dispatch({
            type: Actions.APPEND_DELTA,
            sessionId: sid,
            messageId: activeMsgIds.current[sid],
            delta: msg.delta,
          })
        }
        break
      }

      case 'tool_call': {
        const mid = activeMsgIds.current[sid]
        if (!mid) break
        if (msg.status === 'running') {
          dispatch({
            type: Actions.ADD_TOOL_CALL,
            sessionId: sid,
            messageId: mid,
            toolId: msg.tool_id,
            toolName: msg.tool_name,
          })
        } else {
          dispatch({
            type: Actions.UPDATE_TOOL_CALL,
            sessionId: sid,
            messageId: mid,
            toolId: msg.tool_id,
            status: 'done',
            result: msg.result,
          })
        }
        break
      }

      case 'ui_card': {
        const mid = activeMsgIds.current[sid]
        if (mid) {
          dispatch({
            type: Actions.SET_UI_CARD,
            sessionId: sid,
            messageId: mid,
            uiCard: { type: msg.card_type, data: msg.data },
          })
        }
        break
      }

      case 'done': {
        const mid = activeMsgIds.current[sid]
        if (mid) {
          dispatch({
            type: Actions.SET_MSG_STATUS,
            sessionId: sid,
            messageId: mid,
            status: 'done',
          })
          delete activeMsgIds.current[sid]
        }
        generatingSessions.current.delete(sid)
        syncGeneratingState(sessionId)
        break
      }

      case 'error': {
        delete activeMsgIds.current[sid]
        generatingSessions.current.delete(sid)
        syncGeneratingState(sessionId)
        dispatch({
          type: Actions.ADD_MESSAGE,
          sessionId: sid,
          message: {
            id: newId(),
            role: 'assistant',
            content: `⚠️ ${msg.message}`,
            status: 'done',
            toolCalls: [],
          },
        })
        break
      }

      default:
        break
    }
  }, [dispatch, newId, sessionId, syncGeneratingState])

  // ── Send a user message (enforcing 1 in-flight per session) ──────────────────
  const sendMessage = useCallback((text) => {
    const sid = sessionId
    if (!sid || !text.trim()) return

    if (generatingSessions.current.has(sid)) {
      console.warn('Response already in-flight for this session.')
      return
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      console.warn('WebSocket not open — queuing reconnect')
      connect(sid)
      return
    }

    generatingSessions.current.add(sid)
    syncGeneratingState(sid)

    dispatch({
      type: Actions.ADD_MESSAGE,
      sessionId: sid,
      message: {
        id: newId(),
        role: 'user',
        content: text.trim(),
        status: 'done',
      },
    })

    delete activeMsgIds.current[sid]

    wsRef.current.send(JSON.stringify({
      type: 'text',
      session_id: sid,
      text: text.trim(),
      model: state.model || 'gemini-3.1-flash-lite',
      temperature: typeof state.temperature === 'number' ? state.temperature : 0.7,
    }))
  }, [sessionId, dispatch, newId, connect, syncGeneratingState, state.model, state.temperature])

  // ── Create New Chat ─────────────────────────────────────────────────────────
  const createNewChat = useCallback(async () => {
    try {
      const res = await fetch('/api/session', { method: 'POST' })
      const data = await res.json()
      const newSid = data.session_id
      dispatch({ type: Actions.CREATE_NEW_SESSION, sessionId: newSid })
      syncGeneratingState(newSid)
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: 'init', session_id: newSid }))
      }
      return newSid
    } catch (e) {
      console.error('Failed to create new session:', e)
    }
  }, [dispatch, syncGeneratingState])

  // ── Switch to Existing Chat ─────────────────────────────────────────────────
  const switchChat = useCallback((sid) => {
    if (!sid || sid === sessionId) return
    syncGeneratingState(sid)
    dispatch({ type: Actions.SWITCH_SESSION, sessionId: sid })
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'init', session_id: sid }))
    }
  }, [sessionId, dispatch, syncGeneratingState])

  // ── Delete Chat ─────────────────────────────────────────────────────────────
  const deleteChat = useCallback((sid) => {
    generatingSessions.current.delete(sid)
    delete activeMsgIds.current[sid]
    dispatch({ type: Actions.DELETE_SESSION, sessionId: sid })
    fetch(`/api/session/${sid}`, { method: 'DELETE' }).catch(() => {})
  }, [dispatch])

  // ── Reset session ───────────────────────────────────────────────────────────
  const resetSession = useCallback(async () => {
    const sid = sessionId
    if (sid) {
      generatingSessions.current.delete(sid)
      delete activeMsgIds.current[sid]
      setIsGenerating(false)
      try {
        await fetch(`/api/session/${sid}`, { method: 'DELETE' })
      } catch (_) {}
    }
    dispatch({ type: Actions.RESET })
    if (wsRef.current?.readyState === WebSocket.OPEN && sid) {
      wsRef.current.send(JSON.stringify({ type: 'init', session_id: sid }))
    }
  }, [sessionId, dispatch])

  // ── Sync generating state whenever sessionId changes ────────────────────────
  useEffect(() => {
    syncGeneratingState(sessionId)
  }, [sessionId, syncGeneratingState])

  // ── Lifecycle ───────────────────────────────────────────────────────────────
  useEffect(() => {
    isMounted.current = true
    connect()
    return () => {
      isMounted.current = false
      clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    connectionStatus: state.connectionStatus,
    isGenerating,
    sendMessage,
    createNewChat,
    switchChat,
    deleteChat,
    resetSession,
  }
}
