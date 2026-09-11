# Frontend UI Spec — Goal-Aware Chatbot (React)

> Fill in `{{GOAL_TOPIC}}` for branding/copy once known. Structure is ready to build tonight.

## 1. Tech Stack

- **Build tool:** Vite
- **Framework:** React 18 (functional components + hooks)
- **Styling:** Tailwind CSS
- **Icons:** lucide-react
- **Markdown rendering:** `react-markdown` (+ `remark-gfm` for tables)
- **State:** React Context + `useReducer` for chat state (no need for Redux/Zustand at this scale)
- **Transport:** native WebSocket (matches backend `/ws/chat`)

## 2. Component Tree

```
<App>
 └─ <ChatProvider>                 // context: messages, session_id, connection status
     └─ <ChatLayout>
         ├─ <SessionHeader />      // title = {{GOAL_TOPIC}}, connection status dot, reset button
         ├─ <MessageList>
         │    ├─ <MessageBubble />       // user or assistant, markdown-rendered
         │    ├─ <ToolCallIndicator />   // shows "Executing: get_status..." while a tool runs
         │    └─ <GenerativeUICard />    // renders structured JSON events as cards/tables/badges
         ├─ <MemoryDrawer />        // optional/bonus: shows what's in long-term memory, collapsible
         └─ <InputBar>
              ├─ <TextInput />
              └─ <SendButton />
```

## 3. State Shape (Context)

```ts
type Message = {
  id: string;
  role: "user" | "assistant" | "tool";
  content: string;           // markdown text (streamed, appended token by token)
  status: "streaming" | "done";
  toolCalls?: { name: string; status: "running" | "done" }[];
  uiCard?: GenerativeUIPayload;  // optional structured widget
};

type ChatState = {
  sessionId: string | null;
  connectionStatus: "connecting" | "open" | "closed" | "error";
  messages: Message[];
};
```

## 4. WebSocket Hook (`useChatSocket`)

Responsibilities:
- Opens `ws://<backend>/ws/chat`, sends `{type:"init", session_id}` on connect (create session via `POST /api/session` first if none exists).
- Sends `{type:"text", session_id, text}` on user submit.
- Listens for server events and reduces them into state:
  - `text_delta` → append to the current streaming message's `content`.
  - `tool_call` → push/update `toolCalls` on the current message.
  - `ui_card` → attach `uiCard` payload to the current message.
  - `done` → mark message `status: "done"`.
  - `error` → show a toast/inline error bubble.
- Auto-reconnect with backoff if the socket drops mid-session.

## 5. Streaming Render Behavior

- Assistant bubble appears immediately on first `text_delta`, text grows in place (no layout jump).
- Markdown renders progressively — don't wait for `done` to parse markdown, re-render on each delta (react-markdown handles partial markdown fine for hackathon purposes).
- While a tool call is in flight, show a small inline pill: `⚙ Running {{tool_name}}…` above the bubble, replaced by the result once resolved.

## 6. Generative UI Cards (differentiator feature)

- Backend can send a `ui_card` event with a `type` field (`table`, `stat`, `badge`, `chart`, etc.) and a `data` payload.
- `<GenerativeUICard>` switches on `type` and renders the matching Tailwind-styled component.
- Keep 3 card types scaffolded tomorrow-ready: `StatCard`, `TableCard`, `BadgeList` — enough to demo "the bot renders real UI, not just text."

## 7. Visual Direction

- Clean, dark-mode-first shell (judges' eyes are tired by hour 20 — dark mode reads better on a projector).
- Single accent color tied to `{{GOAL_TOPIC}}` branding (swap one Tailwind config value, not scattered hex codes).
- Chat column max-width ~720px, centered — don't stretch full width, it hurts readability.
- Connection status as a small colored dot in the header (green/yellow/red), not a blocking banner.

## 8. Directory Structure

```
frontend/
├── src/
│   ├── main.jsx
│   ├── App.jsx
│   ├── context/
│   │   └── ChatContext.jsx
│   ├── hooks/
│   │   └── useChatSocket.js
│   ├── components/
│   │   ├── SessionHeader.jsx
│   │   ├── MessageList.jsx
│   │   ├── MessageBubble.jsx
│   │   ├── ToolCallIndicator.jsx
│   │   ├── GenerativeUICard/
│   │   │   ├── index.jsx
│   │   │   ├── StatCard.jsx
│   │   │   ├── TableCard.jsx
│   │   │   └── BadgeList.jsx
│   │   ├── MemoryDrawer.jsx
│   │   └── InputBar.jsx
│   └── styles/
│       └── index.css           # Tailwind entry
├── tailwind.config.js
├── vite.config.js
└── package.json
```

## 9. What's Left to Fill In Tomorrow

- `{{GOAL_TOPIC}}` copy in `SessionHeader` and page title.
- Accent color in `tailwind.config.js`.
- Any topic-specific `ui_card` types beyond the 3 scaffolded ones.
