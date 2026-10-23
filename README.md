# Kilo QoL + KB Patch

The all-in-one quality-of-life and keyboard patch for the **Kilo Code** VS Code AI chat webview.

Integrates the full functionality of **Kilo Code KB Patch** and **Kilo QoL Patch** into a single, unified extension.

---

## Features

### ⌨️ Full Keyboard & Chat Controls (KB Patch)
- **Enter for newline, Cmd/Ctrl+Enter to send**: Multiline prompt typing feels natural without premature accidental message submits.
- **Smart Escape**: Bare `Escape` aborts/cancels only when the chat input is empty or whitespace-only, preventing accidental cancellation of streaming tasks. `Shift+Escape` always aborts.
- **Mention Escape**: Pressing `Escape` cleanly dismisses the `@` mention menu and keeps it closed until explicitly reopened.
- **Message History Recall**: `Cmd/Ctrl+Up` and `Cmd/Ctrl+Down` cycle through previous prompt history, leaving plain `Up` and `Down` arrow keys for caret navigation inside multiline inputs.
- **Permission Safety Keys**: Prevents typing inside the chat textarea from accidentally triggering global permission dialog shortcuts. `Cmd/Ctrl+Enter` explicitly approves permission prompts.
- **Streaming scroll control**: Scroll upward during a response—including middle-mouse autoscroll—to pause following the latest message so you can read earlier content.
- **Background subagent policy**: Adds a Kilo global instruction telling Kilo to launch every subagent in background mode rather than blocking the main conversation. Disable with `kiloQolPatch.backgroundSubagents`.
- **Hover Guard**: Suppresses synthetic hover and tooltip events while the mouse cursor is hidden during fast typing.

### 📎 Drag & Drop Mentions & Attachments
- **Clean file and folder drag & drop mentions**: Drag and drop any file or folder from the VS Code Explorer straight into the chat input. Only the clean `@filename` or `@folder_name` is displayed in chat text (no ugly long paths), while the full absolute disk path is mapped under the hood in `window.__kqpDroppedPaths` and attached with `file://` URLs for backend tools and AI.
- **Attach file button (`+`)**: Optional direct file picker button added to the prompt toolbar.

### 📐 Math Rendering & Raw Markdown Source
- **KaTeX Math Rendering**: Supports standard single-dollar `$...$` inline math and `\[...\]` display math in chat (in addition to `$$...$$` and `\(...\)`). Font size is configurable.
- **Raw Markdown Toggle**: Adds a button beside **Copy** under assistant responses to toggle between rendered view and raw markdown source.
- **Custom Response Typography**: Configurable font size scaling multiplier (`kiloQolPatch.chatHistoryFontSizeEm`) and custom font family (`kiloQolPatch.chatHistoryFontFamily`) with proportional heading ladder.

### 🖼️ MCP Inline Images & Expanded Cards (QoL)
- **Inline rendering of MCP tool-result images**: Images from tools (e.g. `read_image`, browser screenshots, data URLs) render directly inline in chat cards with labels and click-to-zoom.
- **Auto-expanded tool & reasoning cards**: Tool execution cards and thinking blocks start expanded by default.
- **Show all chats (cross-workspace history)**: Shows chat sessions from all workspace folders in the history sidebar on demand.

### 🎨 Visual & Layout Styling
- **Full-width chat panel**: Messages fill the full panel width (`--chat-readable-width: 100%`).
- **Clean tool cards**: Trae-style border and trigger padding.
- **Syntax-highlighted code blocks**: Dark `#0d1117` background with readable `#e6edf3` contrast.
- **Field-sizing auto-expanding input**: Textarea expands naturally with content.
- **Compact chat layout**: Optional tighter spacing in assistant replies and tool cards.
- **Code line wrapping**: Optional wrapping of long code lines to avoid horizontal scrolling.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `kiloQolPatch.autoApply` | `true` | Automatically apply patch on startup or after Kilo Code updates. |
| `kiloQolPatch.showStatusBar` | `true` | Show status bar item with quick menu. |
| `kiloQolPatch.keyboardShortcuts` | `true` | Enter for newline, Cmd/Ctrl+Enter to send, smart Escape, history recall. |
| `kiloQolPatch.addAttachFileButton` | `false` | Add `+` button to prompt toolbar for direct file picking. |
| `kiloQolPatch.chatMathRendering` | `true` | Render `$...$` inline and `\[...\]` display math via KaTeX. |
| `kiloQolPatch.chatMathFontSizeEm` | `1.21` | Font size multiplier for rendered math in chat. |
| `kiloQolPatch.chatRawMarkdownButton` | `true` | Add button to toggle raw markdown source under assistant replies. |
| `kiloQolPatch.chatHistoryFontSizeEm` | `1` | Font size multiplier for agent responses in chat history. |
| `kiloQolPatch.chatHistoryFontFamily` | `""` | CSS font family for agent responses (e.g. `Charter, Georgia, serif`). |
| `kiloQolPatch.compactChatLayout` | `false` | Reduce vertical spacing in assistant markdown and tool cards. |
| `kiloQolPatch.chatCodeWrap` | `false` | Wrap long code lines instead of requiring horizontal scrolling. |
| `kiloQolPatch.backgroundSubagents` | `true` | Add a global Kilo instruction to start all subagents in background mode. |
| `kiloQolPatch.fillChatWidth` | `true` | Apply Trae cards, readable code blocks, and full panel width. |
| `kiloQolPatch.showAllChats` | `false` | Surface chats across all workspace folders. |
| `kiloQolPatch.renameOpenInTab` | `false` | Rename editor title action to "Kilo Code: Open". |

---

## Commands

- **Kilo QoL Patch: Apply / Re-apply**
- **Kilo QoL Patch: Remove (restore original)**
- **Kilo QoL Patch: Status**
- **Kilo QoL Patch: Open Menu**
- **Kilo QoL Patch: Toggle Show All Chats**

---

## Safety & Restoration
Original Kilo files are automatically backed up to `*.qolpatch.bak` before any modification. The background-subagent option adds only its own rule path to Kilo's global `instructions` list; turning it off or uninstalling removes only that managed entry and leaves other Kilo configuration and rules untouched.

## License
MIT
