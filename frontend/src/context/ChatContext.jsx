/**
 * context/ChatContext.jsx
 *
 * Global chat state: multi-session persistence, session-isolated message handling.
 */
import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react'

const STORAGE_KEY = 'nextgen_chat_sessions_v1'
const ACTIVE_SESSION_KEY = 'nextgen_active_session_id'

function loadSavedSessions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (e) {
    console.error('Failed to load sessions from localStorage:', e)
  }
  return []
}

function saveSessions(sessions) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions))
  } catch (e) {
    console.error('Failed to save sessions to localStorage:', e)
  }
}

function getInitialActiveSessionId(sessions) {
  try {
    const saved = localStorage.getItem(ACTIVE_SESSION_KEY)
    if (saved && sessions.some(s => s.id === saved)) {
      return saved
    }
  } catch (e) {}
  return sessions[0]?.id || null
}

const initialSessions = loadSavedSessions()
const initialActiveId = getInitialActiveSessionId(initialSessions)
const activeSession = initialSessions.find(s => s.id === initialActiveId)

const initialState = {
  sessionId: initialActiveId,
  connectionStatus: 'closed', // 'connecting' | 'open' | 'closed' | 'error'
  messages: activeSession ? activeSession.messages : [],
  sessions: initialSessions,
  model: activeSession?.model || 'gemini-3.1-flash-lite',
  temperature: typeof activeSession?.temperature === 'number' ? activeSession.temperature : 0.7,
  theme: localStorage.getItem('nextgen_theme_pref') || 'system',
}

export const Actions = {
  SET_SESSION:          'SET_SESSION',
  SET_CONNECTION:       'SET_CONNECTION',
  ADD_MESSAGE:          'ADD_MESSAGE',
  APPEND_DELTA:         'APPEND_DELTA',
  SET_MSG_STATUS:       'SET_MSG_STATUS',
  ADD_TOOL_CALL:        'ADD_TOOL_CALL',
  UPDATE_TOOL_CALL:     'UPDATE_TOOL_CALL',
  SET_UI_CARD:          'SET_UI_CARD',
  CREATE_NEW_SESSION:   'CREATE_NEW_SESSION',
  SWITCH_SESSION:       'SWITCH_SESSION',
  DELETE_SESSION:       'DELETE_SESSION',
  RESET:                'RESET',
  SET_MODEL:            'SET_MODEL',
  SET_TEMPERATURE:      'SET_TEMPERATURE',
  SET_THEME:            'SET_THEME',
}

function chatReducer(state, action) {
  let nextState = state

  switch (action.type) {
    case Actions.SET_SESSION: {
      const exists = state.sessions.some(s => s.id === action.sessionId)
      let updatedSessions = state.sessions
      if (!exists && action.sessionId) {
        const newSess = {
          id: action.sessionId,
          title: 'New Chat',
          messages: state.messages,
          updatedAt: Date.now(),
        }
        updatedSessions = [newSess, ...state.sessions]
      }
      nextState = {
        ...state,
        sessionId: action.sessionId,
        sessions: updatedSessions,
      }
      break
    }

    case Actions.SET_CONNECTION:
      return { ...state, connectionStatus: action.status }

    case Actions.ADD_MESSAGE: {
      const targetSid = action.sessionId || state.sessionId
      let targetSessionFound = false

      let updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          targetSessionFound = true
          let title = s.title
          if ((!title || title === 'New Chat') && action.message.role === 'user') {
            title = action.message.content.slice(0, 32) || 'New Chat'
          }
          return {
            ...s,
            title,
            messages: [...s.messages, action.message],
            updatedAt: Date.now(),
          }
        }
        return s
      })

      if (!targetSessionFound && targetSid) {
        let title = action.message.role === 'user' ? action.message.content.slice(0, 32) : 'New Chat'
        updatedSessions = [
          { id: targetSid, title, messages: [action.message], updatedAt: Date.now() },
          ...updatedSessions,
        ]
      }

      // ONLY update the active view if this message belongs to the active session!
      const isCurrent = targetSid === state.sessionId
      const newMessages = isCurrent ? [...state.messages, action.message] : state.messages

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.APPEND_DELTA: {
      const targetSid = action.sessionId || state.sessionId

      // Update in target session array
      const updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          const msgs = [...s.messages]
          const lastIdx = msgs.findIndex(m => m.id === action.messageId)
          if (lastIdx !== -1) {
            msgs[lastIdx] = {
              ...msgs[lastIdx],
              content: msgs[lastIdx].content + action.delta,
              status: 'streaming',
            }
          }
          return { ...s, messages: msgs }
        }
        return s
      })

      // ONLY update visible messages if targetSid matches active session!
      let newMessages = state.messages
      if (targetSid === state.sessionId) {
        const lastIdx = newMessages.findIndex((m) => m.id === action.messageId)
        if (lastIdx !== -1) {
          const updated = [...newMessages]
          updated[lastIdx] = {
            ...updated[lastIdx],
            content: updated[lastIdx].content + action.delta,
            status: 'streaming',
          }
          newMessages = updated
        }
      }

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.SET_MSG_STATUS: {
      const targetSid = action.sessionId || state.sessionId

      const updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          const msgs = s.messages.map(m =>
            m.id === action.messageId ? { ...m, status: action.status } : m
          )
          return { ...s, messages: msgs, updatedAt: Date.now() }
        }
        return s
      })

      let newMessages = state.messages
      if (targetSid === state.sessionId) {
        newMessages = state.messages.map((m) =>
          m.id === action.messageId ? { ...m, status: action.status } : m
        )
      }

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.ADD_TOOL_CALL: {
      const targetSid = action.sessionId || state.sessionId

      const updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          const msgs = s.messages.map(m =>
            m.id === action.messageId
              ? {
                  ...m,
                  toolCalls: [
                    ...(m.toolCalls || []),
                    { id: action.toolId, name: action.toolName, status: 'running' },
                  ],
                }
              : m
          )
          return { ...s, messages: msgs }
        }
        return s
      })

      let newMessages = state.messages
      if (targetSid === state.sessionId) {
        newMessages = state.messages.map((m) =>
          m.id === action.messageId
            ? {
                ...m,
                toolCalls: [
                  ...(m.toolCalls || []),
                  { id: action.toolId, name: action.toolName, status: 'running' },
                ],
              }
            : m
        )
      }

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.UPDATE_TOOL_CALL: {
      const targetSid = action.sessionId || state.sessionId

      const updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          const msgs = s.messages.map(m =>
            m.id === action.messageId
              ? {
                  ...m,
                  toolCalls: (m.toolCalls || []).map((tc) =>
                    tc.id === action.toolId
                      ? { ...tc, status: action.status, result: action.result }
                      : tc
                  ),
                }
              : m
          )
          return { ...s, messages: msgs }
        }
        return s
      })

      let newMessages = state.messages
      if (targetSid === state.sessionId) {
        newMessages = state.messages.map((m) =>
          m.id === action.messageId
            ? {
                ...m,
                toolCalls: (m.toolCalls || []).map((tc) =>
                  tc.id === action.toolId
                    ? { ...tc, status: action.status, result: action.result }
                    : tc
                ),
              }
            : m
        )
      }

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.SET_UI_CARD: {
      const targetSid = action.sessionId || state.sessionId

      const updatedSessions = state.sessions.map(s => {
        if (s.id === targetSid) {
          const msgs = s.messages.map(m =>
            m.id === action.messageId ? { ...m, uiCard: action.uiCard } : m
          )
          return { ...s, messages: msgs }
        }
        return s
      })

      let newMessages = state.messages
      if (targetSid === state.sessionId) {
        newMessages = state.messages.map((m) =>
          m.id === action.messageId ? { ...m, uiCard: action.uiCard } : m
        )
      }

      nextState = { ...state, messages: newMessages, sessions: updatedSessions }
      break
    }

    case Actions.CREATE_NEW_SESSION: {
      const newSession = {
        id: action.sessionId,
        title: 'New Chat',
        model: state.model || 'gemini-3.1-flash-lite',
        temperature: state.temperature ?? 0.7,
        messages: [],
        updatedAt: Date.now(),
      }
      const updatedSessions = [newSession, ...state.sessions.filter(s => s.id !== action.sessionId)]
      nextState = {
        ...state,
        sessionId: action.sessionId,
        messages: [],
        sessions: updatedSessions,
      }
      break
    }

    case Actions.SWITCH_SESSION: {
      const target = state.sessions.find(s => s.id === action.sessionId)
      nextState = {
        ...state,
        sessionId: action.sessionId,
        messages: target ? target.messages : [],
        model: target?.model || state.model || 'gemini-3.1-flash-lite',
        temperature: typeof target?.temperature === 'number' ? target.temperature : state.temperature,
      }
      break
    }

    case Actions.DELETE_SESSION: {
      const remaining = state.sessions.filter(s => s.id !== action.sessionId)
      let nextId = state.sessionId
      let nextMsgs = state.messages
      if (state.sessionId === action.sessionId) {
        nextId = remaining[0]?.id || null
        nextMsgs = remaining[0]?.messages || []
      }
      nextState = {
        ...state,
        sessionId: nextId,
        messages: nextMsgs,
        sessions: remaining,
      }
      break
    }

    case Actions.RESET: {
      const updatedSessions = state.sessions.map(s =>
        s.id === state.sessionId ? { ...s, messages: [], updatedAt: Date.now() } : s
      )
      nextState = { ...state, messages: [], sessions: updatedSessions }
      break
    }

    case Actions.SET_MODEL: {
      const updatedSessions = state.sessions.map(s =>
        s.id === state.sessionId ? { ...s, model: action.model, updatedAt: Date.now() } : s
      )
      nextState = { ...state, model: action.model, sessions: updatedSessions }
      break
    }

    case Actions.SET_TEMPERATURE: {
      const updatedSessions = state.sessions.map(s =>
        s.id === state.sessionId ? { ...s, temperature: action.temperature, updatedAt: Date.now() } : s
      )
      nextState = { ...state, temperature: action.temperature, sessions: updatedSessions }
      break
    }

    case Actions.SET_THEME: {
      localStorage.setItem('nextgen_theme_pref', action.theme)
      nextState = { ...state, theme: action.theme }
      break
    }

    default:
      return state
  }

  return nextState
}

const ChatContext = createContext(null)

export function ChatProvider({ children }) {
  const [state, dispatch] = useReducer(chatReducer, initialState)

  // Save sessions to localStorage whenever sessions change
  useEffect(() => {
    saveSessions(state.sessions)
    if (state.sessionId) {
      localStorage.setItem(ACTIVE_SESSION_KEY, state.sessionId)
    }
  }, [state.sessions, state.sessionId])

  // Apply theme to HTML root
  useEffect(() => {
    const applyTheme = () => {
      const isDark = state.theme === 'dark' || (state.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
      document.documentElement.classList.toggle('dark', isDark)
      document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light')
    }
    applyTheme()
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    mql.addEventListener('change', applyTheme)
    return () => mql.removeEventListener('change', applyTheme)
  }, [state.theme])

  const newId = useCallback(() =>
    Math.random().toString(36).slice(2) + Date.now().toString(36),
  [])

  return (
    <ChatContext.Provider value={{ state, dispatch, newId }}>
      {children}
    </ChatContext.Provider>
  )
}

export function useChatContext() {
  const ctx = useContext(ChatContext)
  if (!ctx) throw new Error('useChatContext must be used inside <ChatProvider>')
  return ctx
}
