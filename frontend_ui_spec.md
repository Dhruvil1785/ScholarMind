# Frontend UI Specification — ScholarMind AI Learning Tutor (React + Vite + Tailwind)

> **Design System, Component Hierarchy, and Interaction Specifications for ScholarMind**

---

## 1. Tech Stack

- **Build Tool:** Vite 5
- **Framework:** React 18 (Functional components with hooks)
- **Styling:** Tailwind CSS (Dark-mode first, warm editorial aesthetic)
- **Icons:** `lucide-react`
- **Markdown & Code Rendering:** `react-markdown` + `remark-gfm` (Tables, task lists, strikethrough)
- **State Management:** React Context (`ChatContext`) with `useReducer`
- **Transport Mechanisms:**
  - **Native WebSockets (`useChatSocket`):** Real-time streaming deltas, tool status indicators, and Generative UI card events.
  - **Direct REST (`useRestChat`):** High-reliability `POST /chat` judging endpoint integration.

---

## 2. Component Hierarchy

```
<App>
 └─ <ChatProvider>                    // Global state: messages, sessions, model, temperature, theme
     └─ <ChatLayout>
         ├─ <ChatSidebar />           // Session history list, temperature slider, memory trigger
         └─ Main Chat Area
             ├─ <SessionHeader />     // ScholarMind logo/title, 3-way theme toggle (Light/Dark/Sys), clear button
             ├─ <MessageList>         // Scrollable message feed with auto-scroll lock
             │    ├─ <MessageBubble />       // User/Assistant markdown bubbles with copy action
             │    ├─ <ToolCallIndicator />   // Animated pill: "⚙ Executing [tool_name]..."
             │    └─ <GenerativeUICard />    // Dynamic widgets: StatCard, TableCard, BadgeList
             ├─ <InputBar>            // Text input, send button, embedded model popover dropdown
             └─ <MemoryModal />       // 3-Tier memory inspector & study document ingestion modal
```

---

## 3. Key UI Components & Interactions

### 3.1 SessionHeader (`SessionHeader.jsx`)
- **Branding:** Displays the animated `ScholarMindLogo` and title with SDG 4 subtitle.
- **Connection Indicator:** Live badge displaying WebSocket status (`Connected`, `Connecting`, `Disconnected`).
- **3-Way Theme Switcher:** Toggles seamlessly between **Light**, **Dark**, and **System Default** themes.
- **Session Reset:** One-click clear button to reset the current active conversation.

### 3.2 ChatSidebar (`ChatSidebar.jsx`)
- **New Chat Button:** Instantly generates a clean session.
- **Session History:** Lists previous conversation threads with timestamps.
- **Temperature Control:** Interactive slider ($0.0$ to $1.0$) to adjust AI tutor creativity versus deterministic rigor.
- **Memory Inspector Trigger:** Quick-access button (or shortcut) to open the 3-tier memory modal.

### 3.3 InputBar & Model Selector (`InputBar.jsx`)
- **Multi-line Textarea:** Auto-expanding input field with Enter-to-send and Shift+Enter for newlines.
- **Model Selector Popover:** Clean popover allowing users to switch models:
  - `gemini-3.1-flash-lite` (Default — fastest & highest rate limit)
  - `gemini-3.7-flash` (Advanced reasoning & coding)
  - `gemini-2.5-flash` (Balanced multi-turn performance)
- **Send & Loading State:** Visual spinner when generation is in progress.

### 3.4 Message Stream & Generative UI (`MessageList.jsx`)
- **Progressive Markdown:** Streaming text updates token-by-token using `react-markdown`.
- **Generative UI Cards:** Automatically rendered when the backend emits `ui_card`:
  - `StatCard`: Key metrics (e.g., student mastery score, target SDG 4 indicator).
  - `TableCard`: Structured study schedules, quiz breakdowns, or comparison charts.
  - `BadgeList`: Tags for topic categories, completed achievements, or learning pillars.

### 3.5 Memory & Ingestion Modal (`MemoryModal.jsx`)
A comprehensive inspector divided into three interactive tabs:
1. **Working Memory Tab:** Inspects the raw sliding window of recent conversation turns.
2. **Episodic Long-Term Memory Tab:** Allows the user to test semantic vector queries against ChromaDB to see what study materials match.
3. **Document Ingestion Tab:** One-click button to trigger ingestion of `data/goal_materials/` documents with live chunk indexing feedback.

---

## 4. Design Aesthetics & Colors

- **Visual Tone:** Clean, editorial, distraction-free learning environment.
- **Color Palette:**
  - Background: `bg-slate-50` (Light) / `bg-slate-950` (Dark)
  - Surface Cards: `bg-white` (Light) / `bg-slate-900` (Dark)
  - Accent / Primary: `emerald-600` / `teal-600` (Representing growth, education, and clarity)
  - Text: `text-slate-900` (Light) / `text-slate-100` (Dark)
- **Typography:** Modern sans-serif with readable font scale, generous line height, and distinct code blocks.
