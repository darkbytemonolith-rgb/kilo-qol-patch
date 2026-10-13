// Pure patch definitions + string transforms. No vscode dependency, so this can
// be unit-run with plain node. extension.js wraps this with VS Code UI.
//
// Combined Kilo QoL + KB Patch features:
//   1. webview.js  -> render MCP tool-result images inline (one per row + path).
//   2. webview.js  -> every tool card and the reasoning block start expanded.
//   3. webview.js  -> show all chats (webview side):
//      a. Gate the Opt session prune on window.__kiloQolShowAllChats.
//      b. Read showAllChats from the host `ready` message.
//      c. Bypass the Npt projectId mismatch filter so cross-project
//         sessionsLoaded messages are accepted.
//   4. webview.js  -> clean drag-and-drop mentions for files and folders:
//      a. Dropping file or folder inserts clean @filename or @foldername.
//      b. Map clean mention names to actual full paths in window.__kqpDroppedPaths.
//      c. EVn resolves clean mentions to real disk paths and attaches them with file:// URLs.
//      d. Clicking mention pill opens real file path.
//   5. webview.js  -> KB patch keyboard rules (derived dynamically via kb-rules):
//      a. chat-input: Enter for newline, Cmd/Ctrl+Enter to send.
//      b. chat-escape: Smart Escape (bare Escape aborts only when empty; Shift+Escape always).
//      c. mention-escape: Keeps @ mention menu closed when dismissed.
//      d. chat-history: Cmd/Ctrl+Up/Down for message recall; plain Up/Down for caret navigation.
//      e. perm-keys: Prevents textarea typing from triggering permission shortcuts.
//      f. perm-escape: Safe Escape on permission dialogs.
//      g. perm-approve: Cmd/Ctrl+Enter approves permission dialogs.
//      h. doc-escape: Document-level escape safety.
//      i. kiloclaw-edit & kiloclaw-chat (when present).
//   6. webview.js  -> KB patch extra features:
//      a. attach-button (+ button in prompt toolbar to attach files).
//      b. math-rendering (KaTeX $...$ inline and \[...\] display math).
//      c. raw-markdown (toggle button under assistant replies for markdown source).
//   7. webview.js  -> KB script blocks:
//      a. chat-scroll: Keeps history pinned at bottom while typing.
//      b. hover-guard: Suppresses synthetic hover events while mouse is hidden during typing.
//   8. extension.js (host) -> show all chats (host side):
//      a. Pass kiloQolPatch.showAllChats in ready postMessage and set globalThis.__kqpShowAllChats.
//      b. sessionDirs() returns [undefined] when active so backend lists all sessions.
//      c. registerSession activates cross-project sessions.
//   9. webview.css -> styling:
//      a. Tool cards restyled with borders and clean trigger padding.
//      b. Syntax-highlighted dark code blocks (#0d1117, #e6edf3).
//      c. Chat layout 100% readable width.
//      d. Input field-sizing auto-expands.
//      e. math-clip, raw-markdown, and configurable typography/math font sizing.
//  10. package.json -> optional renameOpenInTab ("Open in Tab" -> "Kilo Code: Open").

const fs = require("fs");
const path = require("path");
const kbRules = require("./kb-rules");

// Markers
const MARKER = "\n//__KILO_QOL_PATCH_v9__\n";
const OLD_MARKERS = [
  "//__MCPIMG_PATCH_v1__",
  "//__MCPIMG_PATCH_v2__",
  "//__MCPIMG_PATCH_v3__",
  "//__MCPIMG_PATCH_v4__",
  "//__KILO_QOL_PATCH_v5__",
  "//__KILO_QOL_PATCH_v6__",
  "//__KILO_QOL_PATCH_v7__",
  "//__KILO_QOL_PATCH_v8__",
];

// ---- webview.js image patch ----
const R1_FIND = `=()=>e.tool==="board_post"||e.tool==="board_read",`;
const R1_REPL =
  `=()=>e.tool==="board_post"||e.tool==="board_read",` +
  `__mcpDlg=(()=>{try{return Ti()}catch(_e){return null}})(),` +
  `__mcpImgs=ye(()=>{var at=(e.attachments||[]).filter(z=>z&&typeof z.mime=="string"&&z.mime.startsWith("image/")&&z.url),in0=e.input,ip=(in0&&((Array.isArray(in0.paths)?in0.paths:[]).concat(typeof in0.path=="string"?[in0.path]:[],typeof in0.filename=="string"?[in0.filename]:[],Array.isArray(in0.shots)?in0.shots.filter(s=>s&&typeof s.filename=="string").map(s=>s.filename):[])))||[];return at.map((z,i)=>({url:z.url,alt:z.filename||ip[i]||("image "+(i+1)),label:z.filename||ip[i]||""}))}),`;

const IMG = `C(le,{get when(){return __mcpImgs().length>0},get children(){var G=document.createElement("div");G.setAttribute("data-component","mcp-images");G.style.display="flex";G.style.flexDirection="column";G.style.gap="10px";G.style.margin="6px 0";return P(G,C(Nt,{get each(){return __mcpImgs()},children:z=>{var W=document.createElement("div");W.style.display="flex";W.style.flexDirection="column";W.style.gap="4px";if(z.label){var L=document.createElement("div");L.textContent=z.label;L.style.fontFamily="var(--vscode-editor-font-family,monospace)";L.style.fontSize="11px";L.style.opacity="0.7";L.style.wordBreak="break-all";W.appendChild(L)}var M=document.createElement("img");M.src=z.url;M.alt=z.alt;M.style.maxWidth="25%";M.style.maxHeight="360px";M.style.borderRadius="6px";M.style.border="1px solid var(--vscode-panel-border,rgba(128,128,128,0.3))";M.style.cursor="zoom-in";M.style.objectFit="contain";M.style.alignSelf="flex-start";M.addEventListener("click",()=>{__mcpDlg&&__mcpDlg.show(()=>C(Cje,{src:z.url,alt:z.alt}))});W.appendChild(M);return W}})),G}})`;

const R2_FIND = `,C(le,{get when(){return o()},children:y=>(()=>{var v=Oka();`;
const R2_REPL =
  `,` + IMG + `,C(le,{get when(){return o()},children:y=>(()=>{var v=Oka();`;

// ---- webview.js expanded-by-default patch ----
const EXP_FIND = `get defaultOpen(){return j5n(m,o(),s(),l())}`;
const EXP_REPL = `get defaultOpen(){return !0}`;
const RS_FIND = `get reasoningDisplay(){return r.reasoningDisplay()}`;
const RS_REPL = `get reasoningDisplay(){return"expanded"}`;

// ---- webview.js show-all-chats patch ----
const SAC_OPT_FIND = `if(!e.append)for(let i of Object.keys(a))i.startsWith("cloud:")||r.has(i)||t.has(i)||delete a[i]`;
const SAC_OPT_REPL = `if(!e.append&&!(window.__kiloQolShowAllChats===true))for(let i of Object.keys(a))i.startsWith("cloud:")||r.has(i)||t.has(i)||delete a[i]`;

const SAC_READY_FIND = `U.type==="ready"&&U.fontSize!==void 0&&$Q(U.fontSize)`;
const SAC_READY_REPL = `U.type==="ready"&&U.fontSize!==void 0&&($Q(U.fontSize),typeof U.showAllChats=="boolean"&&(window.__kiloQolShowAllChats=U.showAllChats))`;

const NPT_FIND = `function Npt(e,t){return(e.type==="sessionCreated"||e.type==="sessionsLoaded")&&!!e.projectId&&!!t&&e.projectId!==t}`;
const NPT_REPL = `function Npt(e,t){return window.__kiloQolShowAllChats!==true&&(e.type==="sessionCreated"||e.type==="sessionsLoaded")&&!!e.projectId&&!!t&&e.projectId!==t}`;

// ---- webview.js clean drag-and-drop mentions patch (Antigravity-style) ----
const DRAGOVER_FIND = `handleDragOver:A=>{let b=A.dataTransfer?.types;!b||!(b.includes("Files")||b.includes("application/vnd.code.uri-list")||b.includes(ort))||(A.preventDefault(),r(!0))},`;
const DRAGOVER_REPL = `handleDragOver:A=>{let b=A.dataTransfer?.types;!b||!(b.includes("Files")||b.includes("text/uri-list")||b.includes("application/vnd.code.uri-list")||b.includes("application/vnd.code.tree.explorer")||b.includes("text/plain")||b.includes("text")||b.includes(ort))||(A.preventDefault(),A.dataTransfer&&(A.dataTransfer.dropEffect="copy"),r(!0))},`;

const DVN_FIND = `function DVn(e){let t=e.getData(ort);if(t){let a=t.split(/\\r?\\n/).filter(i=>i.trim()!=="");if(a.length>0)return a}let n=e.getData("application/vnd.code.uri-list");if(n){let a=n.split(/\\r?\\n/).filter(i=>i.trim()!=="");if(a.length>0)return a}let r=e.getData("text");if(r){let a=r.split(/\\r?\\n/).filter(i=>i.trim()!=="");if(a.length>0&&a.every(pni))return a}return null}`;
const DVN_REPL = `function DVn(e){let res=[];let t=e.getData(ort);if(t)res.push(...t.split(/\\r?\\n/).filter(i=>i.trim()!==""));let tree=e.getData("application/vnd.code.tree.explorer");if(tree){try{let parsed=JSON.parse(tree);if(Array.isArray(parsed)){for(let it of parsed){let p=it.resourceUri?.fsPath||it.resourceUri?.path||it.fsPath||it.path||(typeof it==="string"?it:null);if(p)res.push(p);}}}catch(_){}}let n=e.getData("text/uri-list")||e.getData("application/vnd.code.uri-list");if(n)res.push(...n.split(/\\r?\\n/).filter(i=>i.trim()!==""&&!i.startsWith("#")));if(e.files&&e.files.length>0){for(let f of Array.from(e.files)){if(f.path)res.push(f.path);else if(f.name)res.push(f.name);}}let r=e.getData("text/plain")||e.getData("text");if(r&&res.length===0){let a=r.split(/\\r?\\n/).filter(i=>i.trim()!=="");if(a.length>0&&a.every(pni))res.push(...a);}if(res.length>0)return res;return null}`;

const DROP_FIND = `w.setFilePathDropHandler(Ue=>{if(q())return;let Rt=r.workspaceDirectory(),mn=Ue.map(sr=>jAe(sr,Rt)),ur=B;if(!ur)return;let Mr=MVn(ur.value,ur.selectionStart??ur.value.length,mn);ur.value=Mr.text,Z(Mr.text),y.addPaths(mn,Rt),ur.setSelectionRange(Mr.pos,Mr.pos),ur.focus(),ea()});`;
const DROP_REPL = `w.setFilePathDropHandler(Ue=>{if(q())return;let Rt=r.workspaceDirectory();window.__kqpDroppedPaths=window.__kqpDroppedPaths||new Map();let cleanMentions=[];for(let raw of Ue){let p=raw;if(p.startsWith("file://"))p=p.substring(7);else if(p.startsWith("vscode-remote://")){let sl=p.indexOf("/",16);p=sl!==-1?p.substring(sl):p;}try{p=decodeURIComponent(p);}catch(_){}if(p.startsWith("/")&&/^[A-Za-z]:/.test(p.substring(1)))p=p.substring(1);let full=p.replace(/\\\\/g,"/").replace(/\\/+$/,"");let base=full.split("/").filter(Boolean).pop()||full;window.__kqpDroppedPaths.set(base,full);window.__kqpDroppedPaths.set("@"+base,full);window.__kqpDroppedPaths.set(full,full);cleanMentions.push(base);}window.__kqpAddPaths=(b,f)=>{try{y.addPaths([b,f],Rt);}catch(_){}};let ur=B||document.querySelector("textarea.prompt-input")||document.querySelector("textarea");if(!ur)return;let curPos=ur.selectionStart??ur.value.length;let Mr=MVn(ur.value,curPos,cleanMentions);ur.value=Mr.text;Z(Mr.text);y.addPaths([...cleanMentions,...Ue],Rt);ur.setSelectionRange(Mr.pos,Mr.pos);ur.focus();ea();});`;

const EVN_FIND = `function EVn(e,t,n){let r=[],a=gVn(n.replaceAll("\\\\","/")).replace(/\\/+$/,"");for(let i of t){let o=\`@\${i}\`,s=e.indexOf(o);if(s!==-1){let l=dni(i)?i.replaceAll("\\\\","/"):灰\${a}/\${i}灰,d=gVn(l);if(!uni(d,a))continue;let u=new URL("file://");u.pathname=(d.startsWith("/")?d:\`/\${d}\`).replace(/%/g,"%25").replace(/ /g,"%20"),r.push({mime:"text/plain",url:u.href,source:{type:"file",path:i,text:{value:o,start:s,end:s+o.length}}})}}return r}`.replace(/灰/g, '`');
const EVN_REPL = `function EVn(e,t,n){let r=[],a=gVn(n.replaceAll("\\\\","/")).replace(/\\/+$/,"");let allMentions=new Set(t);if(window.__kqpDroppedPaths){for(let[k]of window.__kqpDroppedPaths){if(k&&!k.startsWith("@")&&e.includes("@"+k))allMentions.add(k);}}for(let i of allMentions){let o=\`@\${i}\`,s=e.indexOf(o);if(s!==-1){let full=window.__kqpDroppedPaths?.get(i)||window.__kqpDroppedPaths?.get(o);let targetPath=full?full:(dni(i)?i.replaceAll("\\\\","/"):灰\${a}/\${i}灰);let d=gVn(targetPath);if(!full&&!uni(d,a))continue;let u=new URL("file://");u.pathname=(d.startsWith("/")?d:\`/\${d}\`).replace(/%/g,"%25").replace(/ /g,"%20");r.push({mime:"text/plain",url:u.href,filename:i,source:{type:"file",path:full||i,text:{value:o,start:s,end:s+o.length}}});}}return r}`.replace(/灰/g, '`');

const CLICK_FIND = `m.postMessage({type:"openFile",filePath:cr().text.replace(/^@/,"")})`;
const CLICK_REPL = `m.postMessage({type:"openFile",filePath:window.__kqpDroppedPaths?.get(cr().text.replace(/^@/,""))||cr().text.replace(/^@/,"")})`;

// ---- KB patch script blocks ----
const CHAT_SCROLL_SCRIPT = [
  "(() => {",
  "  // Kilo Code KB Patch: keep chat history at bottom across edits",
  "  const listOf = (e) => {",
  "    const t = e.target;",
  '    return t instanceof HTMLTextAreaElement && t.matches("textarea.prompt-input")',
  '      ? t.closest(".chat-view")?.querySelector(".message-list") ?? null',
  "      : null;",
  "  };",
  "  let pinned = null;",
  '  window.addEventListener("beforeinput", (e) => {',
  "    const list = listOf(e);",
  "    pinned = list && list.scrollHeight - list.clientHeight - list.scrollTop < 100 ? list : null;",
  "  }, true);",
  '  window.addEventListener("input", (e) => {',
  "    const list = pinned;",
  "    pinned = null;",
  "    if (list && list === listOf(e)) list.scrollTop = list.scrollHeight;",
  "  });",
  "})();",
].join("\n");

const HOVER_GUARD_SCRIPT = [
  "(() => {",
  "  // Kilo Code KB Patch: stop synthetic enter events while mouse cursor is hidden during typing",
  '  const MODIFIERS = new Set(["Alt", "AltGraph", "CapsLock", "Control", "Fn", "FnLock", "Hyper", "Meta", "NumLock", "ScrollLock", "Shift", "Super", "Symbol", "SymbolLock"]);',
  '  const ENTER = ["pointerover", "pointerenter", "mouseover", "mouseenter"];',
  '  const OTHER = ["pointermove", "mousemove", "pointerout", "pointerleave", "mouseout", "mouseleave", "pointerdown", "mousedown", "pointerup", "mouseup"];',
  "  const last = { pointer: null, mouse: null };",
  "  let hidden = false;",
  "  const still = (e) => {",
  '    const kind = e.type.startsWith("pointer") ? "pointer" : "mouse";',
  "    const prev = last[kind];",
  "    last[kind] = [e.screenX, e.screenY];",
  "    if (prev && prev[0] === e.screenX && prev[1] === e.screenY) return true;",
  "    hidden = false;",
  "    return false;",
  "  };",
  '  window.addEventListener("keydown", (e) => {',
  "    if (!e.isTrusted || e.metaKey || MODIFIERS.has(e.key)) return;",
  "    const t = e.target;",
  '    if (t instanceof HTMLTextAreaElement && t.matches("textarea.prompt-input") && t.closest(".chat-view")) hidden = true;',
  "  }, true);",
  "  for (const type of ENTER) {",
  "    window.addEventListener(type, (e) => {",
  "      if (e.isTrusted && still(e) && hidden) e.stopImmediatePropagation();",
  "    }, true);",
  "  }",
  "  for (const type of OTHER) {",
  "    window.addEventListener(type, (e) => {",
  "      if (e.isTrusted) still(e);",
  "    }, true);",
  "  }",
  "})();",
].join("\n");

const DROP_SCRIPT = [
  "(() => {",
  "  // Kilo Code QoL: Global drag-and-drop mentions from Explorer or OS into chat input",
  "  if (window.__kqpDropInstalled) return;",
  "  window.__kqpDropInstalled = true;",
  '  window.addEventListener("dragover", (e) => {',
  "    const t = e.dataTransfer?.types;",
  '    if (t && (t.includes("Files") || t.includes("text/uri-list") || t.includes("application/vnd.code.uri-list") || t.includes("application/vnd.code.tree.explorer") || t.includes("text/plain") || t.includes("text") || t.includes("application/x-kilo-file-path"))) {',
  "      e.preventDefault();",
  '      if (e.dataTransfer) e.dataTransfer.dropEffect = "copy";',
  "    }",
  "  }, true);",
  '  window.addEventListener("drop", (e) => {',
  "    const dt = e.dataTransfer;",
  "    if (!dt) return;",
  "    const paths = [];",
  '    const ortData = dt.getData("application/x-kilo-file-path");',
  "    if (ortData) paths.push(...ortData.split(/\\r?\\n/).filter((x) => x.trim()));",
  '    const treeData = dt.getData("application/vnd.code.tree.explorer");',
  "    if (treeData) {",
  "      try {",
  "        const parsed = JSON.parse(treeData);",
  "        if (Array.isArray(parsed)) {",
  "          for (const item of parsed) {",
  '            const p = item.resourceUri?.fsPath || item.resourceUri?.path || item.fsPath || item.path || (typeof item === "string" ? item : null);',
  "            if (p) paths.push(p);",
  "          }",
  "        }",
  "      } catch (_) {}",
  "    }",
  '    const uriList = dt.getData("text/uri-list") || dt.getData("application/vnd.code.uri-list");',
  '    if (uriList) paths.push(...uriList.split(/\\r?\\n/).filter((x) => x.trim() && !x.startsWith("#")));',
  "    if (dt.files && dt.files.length > 0) {",
  "      for (const f of Array.from(dt.files)) {",
  "        if (f.path) paths.push(f.path);",
  "        else if (f.name) paths.push(f.name);",
  "      }",
  "    }",
  '    const textData = dt.getData("text/plain") || dt.getData("text");',
  '    if (paths.length === 0 && textData && (textData.startsWith("file://") || /^[A-Za-z]:[\\\\/]/.test(textData) || textData.startsWith("/"))) {',
  "      paths.push(...textData.split(/\\r?\\n/).filter((x) => x.trim()));",
  "    }",
  "    if (paths.length > 0) {",
  "      e.preventDefault();",
  "      e.stopPropagation();",
  '      const ta = document.querySelector("textarea.prompt-input") || document.querySelector("textarea");',
  "      if (!ta) return;",
  "      window.__kqpDroppedPaths = window.__kqpDroppedPaths || new Map();",
  "      const cleanMentions = [];",
  "      for (const raw of paths) {",
  "        let p = raw;",
  '        if (p.startsWith("file://")) p = p.substring(7);',
  '        else if (p.startsWith("vscode-remote://")) {',
  '          const sl = p.indexOf("/", 16);',
  "          p = sl !== -1 ? p.substring(sl) : p;",
  "        }",
  "        try { p = decodeURIComponent(p); } catch (_) {}",
  '        if (p.startsWith("/") && /^[A-Za-z]:/.test(p.substring(1))) p = p.substring(1);',
  '        const full = p.replace(/\\\\/g, "/").replace(/\\/+$/, "");',
  '        const base = full.split("/").filter(Boolean).pop() || full;',
  "        window.__kqpDroppedPaths.set(base, full);",
  '        window.__kqpDroppedPaths.set("@" + base, full);',
  "        window.__kqpDroppedPaths.set(full, full);",
  "        cleanMentions.push(base);",
  "        window.__kqpAddPaths?.(base, full);",
  "      }",
  "      const curPos = ta.selectionStart ?? ta.value.length;",
  "      const val = ta.value;",
  "      const before = val.substring(0, curPos);",
  "      const after = val.substring(curPos);",
  '      const pad = before.length > 0 && !/\\s$/.test(before) ? " " : "";',
  '      const ins = cleanMentions.map((b) => "@" + b).join(" ") + " ";',
  "      const next = before + pad + ins + after;",
  "      const nextPos = before.length + pad.length + ins.length;",
  "      ta.value = next;",
  '      ta.dispatchEvent(new Event("input", { bubbles: true }));',
  '      ta.dispatchEvent(new Event("change", { bubbles: true }));',
  "      ta.setSelectionRange(nextPos, nextPos);",
  "      ta.focus();",
  "    }",
  "  }, true);",
  "})();",
].join("\n");

function patchBlock(key, body) {
  return `\n/* kilo-code-kb-patch:${key}:begin */\n${body}\n/* kilo-code-kb-patch:${key}:end */\n`;
}

function stripPatchBlock(content, key) {
  const re = new RegExp(`\\n?\\/\\* kilo-code-kb-patch:${key}:begin \\*\\/[\\s\\S]*?\\/\\* kilo-code-kb-patch:${key}:end \\*\\/\\n?`, "g");
  return content.replace(re, "");
}

function readDerivedRecord(content) {
  const re = /\/\* kilo-code-kb-patch:derived:begin \*\/[\s\S]*?\/\*\s*([A-Za-z0-9+/=]+)\s*\*\/\s*\/\* kilo-code-kb-patch:derived:end \*\//;
  const m = re.exec(content);
  if (!m) return [];
  try {
    return JSON.parse(Buffer.from(m[1], "base64").toString("utf8"));
  } catch (_) {
    return [];
  }
}

function withDerivedRecord(content, records) {
  let cleaned = stripPatchBlock(content, "derived");
  if (!records || records.length === 0) return cleaned;
  const json = JSON.stringify(records);
  const b64 = Buffer.from(json).toString("base64");
  const body = [
    "/* Derivations recorded at apply; read by Status, Apply and Restore. */",
    "/* DO NOT EDIT: managed automatically by kilo-code-kb-patch.          */",
    `/* ${b64} */`,
  ].join("\n");
  return cleaned + patchBlock("derived", body);
}

// ---- extension.js (host) show-all-chats patch ----
const HOST_READY_FIND = `fontSize:getWebviewFontSize(),workspaceDirectory:this.getProjectDirectory(this.currentSession?.id)})}`;
const HOST_READY_REPL = `fontSize:getWebviewFontSize(),workspaceDirectory:this.getProjectDirectory(this.currentSession?.id),showAllChats:(globalThis.__kqpShowAllChats=vscode46.workspace.getConfiguration("kiloQolPatch").get("showAllChats")===true)})}`;

const SESSION_DIRS_FIND = `function sessionDirs(ctx){let dirs=[ctx.workspaceDirectory],seen=new Set(dirs),extra=ctx.worktreeDirectories?ctx.worktreeDirectories():[...ctx.sessionDirectories.values()];for(let dir3 of extra)seen.has(dir3)||(seen.add(dir3),dirs.push(dir3));return dirs}`;
const SESSION_DIRS_REPL = `function sessionDirs(ctx){if(globalThis.__kqpShowAllChats===true)return[void 0];let dirs=[ctx.workspaceDirectory],seen=new Set(dirs),extra=ctx.worktreeDirectories?ctx.worktreeDirectories():[...ctx.sessionDirectories.values()];for(let dir3 of extra)seen.has(dir3)||(seen.add(dir3),dirs.push(dir3));return dirs}`;

const REGISTER_SESSION_FIND = `project===this.opts.projectQualifier?.()?.projectId&&(this.stopCurrentSessionProcesses(session.id),this.setCurrentSession(session),this.contextSessionID=session.id)`;
const REGISTER_SESSION_REPL = `(globalThis.__kqpShowAllChats===true||project===this.opts.projectQualifier?.()?.projectId)&&(this.stopCurrentSessionProcesses(session.id),this.setCurrentSession(session),this.contextSessionID=session.id)`;

// ---- CSS rules ----
const CSS_MARKER = "/*__KQP_CSS_v7__*/";
const CSS_OLD_MARKERS = [
  "/*__KQP_CSS_v1__*/",
  "/*__KQP_CSS_v2__*/",
  "/*__KQP_CSS_v3__*/",
  "/*__KQP_CSS_v4__*/",
  "/*__KQP_CSS_v5__*/",
  "/*__KQP_CSS_v6__*/",
  CSS_MARKER,
];

const CHAT_ANY_MD = '[data-component="markdown"]';
const CHAT_ASSISTANT_MD = '[data-component="text-part"] [data-component="markdown"]';

const RAW_MARKDOWN_RULES = [
  '[data-component="text-part"][data-kbp-raw-markdown] [data-slot="text-part-body"] > [data-component="markdown"] { display: none; }',
  '[data-slot="text-part-body"] > pre[data-slot="kbp-raw-markdown"] {' +
    " margin: 0; padding: 12px; border: 0.5px solid var(--border-weak-base);" +
    " border-radius: 6px; color: var(--text-base);" +
    " font-family: var(--font-family-mono); font-size: var(--font-size-base);" +
    " line-height: 150%; white-space: pre-wrap; overflow-wrap: anywhere; tab-size: 2; }",
  '[data-component="text-part"][data-kbp-raw-markdown] [data-slot="kbp-raw-markdown-toggle"] { background-color: var(--surface-base-active); }',
  '[data-component="text-part"][data-kbp-raw-markdown] [data-slot="kbp-raw-markdown-toggle"] [data-slot="icon-svg"] { color: var(--icon-strong-base); }',
];

const HEADING_LADDER = {
  h1: 1.875,
  h2: 1.3125,
  h3: 1.3125,
  h4: 1.125,
  h5: 1,
  h6: 1,
};

function headingRules() {
  const groups = new Map();
  for (const [level, ratio] of Object.entries(HEADING_LADDER)) {
    const levels = groups.get(ratio);
    if (levels) levels.push(level);
    else groups.set(ratio, [level]);
  }
  return [...groups].map(([ratio, levels]) => {
    const selector = levels.length === 1 ? levels[0] : `:is(${levels.join(", ")})`;
    return `${CHAT_ASSISTANT_MD} ${selector} { font-size: ${ratio}em; }`;
  });
}

function countOf(hay, needle) {
  let n = 0,
    i = 0;
  while (true) {
    const j = hay.indexOf(needle, i);
    if (j < 0) break;
    n++;
    i = j + 1;
  }
  return n;
}

function isPatched(src) {
  return OLD_MARKERS.some((m) => src.includes(m));
}
function isCurrent(src) {
  return src.includes(MARKER.trim());
}

// Applies full patches to webview.js string:
// 1. Derives & applies KB rules
// 2. Applies QoL transforms
// 3. Appends script blocks (chat-scroll, hover-guard)
// 4. Records derived patterns
function applyToString(src, opts = {}) {
  const {
    keyboardShortcuts = true,
    addAttachFileButton = false,
    chatMathRendering = true,
    chatRawMarkdownButton = true,
  } = opts;

  let out = src;
  const recorded = readDerivedRecord(src);
  const derivedMap = new Map(recorded.map((r) => [r.feature, r]));
  const toRecord = [];

  // Helper to derive and apply a rule
  function applyRule(rule, featureName) {
    const known = derivedMap.get(featureName);
    if (known && out.includes(known.patched)) {
      toRecord.push(known);
      return true;
    }
    if (known && out.includes(known.original)) {
      out = out.replace(known.original, known.patched);
      toRecord.push(known);
      return true;
    }
    const res = rule.derive(out);
    if (res && res.original && res.patched) {
      if (out.includes(res.original)) {
        out = out.replace(res.original, res.patched);
        toRecord.push({
          feature: featureName,
          original: res.original,
          patched: res.patched,
          description: rule.describe || featureName,
        });
        return true;
      }
    }
    return false;
  }

  // 1. Apply core keyboard rules if enabled
  if (keyboardShortcuts) {
    for (const rule of kbRules.RULES) {
      if (rule.file && rule.file !== "webview.js") continue;
      applyRule(rule, rule.key);
    }
  }

  // 2. Apply bonus rules (attach button off by default; pure drag & drop mention focus)
  if (addAttachFileButton) {
    applyRule(kbRules.ATTACH_RULE, "attach-button");
  }
  if (chatMathRendering) {
    applyRule(kbRules.MATH_RULE, "math-rendering");
  }
  if (chatRawMarkdownButton) {
    applyRule(kbRules.RAW_MARKDOWN_RULE, "raw-markdown");
  }

  // 3. Apply QoL transforms
  const c1 = countOf(out, R1_FIND);
  const c2 = countOf(out, R2_FIND);
  const c3 = countOf(out, EXP_FIND);
  const c4 = countOf(out, RS_FIND);
  const c5 = countOf(out, SAC_OPT_FIND);
  const c6 = countOf(out, SAC_READY_FIND);
  const c7 = countOf(out, NPT_FIND);
  const c8 = countOf(out, DROP_FIND);
  const c9 = countOf(out, EVN_FIND);
  const c10 = countOf(out, CLICK_FIND);
  const c11 = countOf(out, DRAGOVER_FIND);
  const c12 = countOf(out, DVN_FIND);

  // If already applied in text, check for replacement strings
  const qolAlreadyApplied =
    out.includes(R1_REPL) &&
    out.includes(R2_REPL) &&
    out.includes(EXP_REPL) &&
    out.includes(RS_REPL) &&
    out.includes(SAC_OPT_REPL) &&
    out.includes(SAC_READY_REPL) &&
    out.includes(NPT_REPL) &&
    out.includes(DRAGOVER_REPL) &&
    out.includes(DVN_REPL) &&
    out.includes(DROP_REPL) &&
    out.includes(EVN_REPL) &&
    out.includes(CLICK_REPL);

  if (!qolAlreadyApplied) {
    if (
      c1 !== 1 ||
      c2 !== 1 ||
      c3 !== 1 ||
      c4 !== 1 ||
      c5 !== 1 ||
      c6 !== 1 ||
      c7 !== 1 ||
      c8 !== 1 ||
      c9 !== 1 ||
      c10 !== 1 ||
      c11 !== 1 ||
      c12 !== 1
    ) {
      return { ok: false, c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12 };
    }
    out = out
      .replace(R1_FIND, R1_REPL)
      .replace(R2_FIND, R2_REPL)
      .replace(EXP_FIND, EXP_REPL)
      .replace(RS_FIND, RS_REPL)
      .replace(SAC_OPT_FIND, SAC_OPT_REPL)
      .replace(SAC_READY_FIND, SAC_READY_REPL)
      .replace(NPT_FIND, NPT_REPL)
      .replace(DRAGOVER_FIND, DRAGOVER_REPL)
      .replace(DVN_FIND, DVN_REPL)
      .replace(DROP_FIND, DROP_REPL)
      .replace(EVN_FIND, EVN_REPL)
      .replace(CLICK_FIND, CLICK_REPL);
  }

  // 4. Strip old markers and script blocks
  for (const m of OLD_MARKERS) out = out.split("\n" + m + "\n").join("");
  out = stripPatchBlock(out, "chat-scroll");
  out = stripPatchBlock(out, "hover-guard");
  out = stripPatchBlock(out, "drop-mention");

  // 5. Append script blocks
  out += patchBlock("chat-scroll", CHAT_SCROLL_SCRIPT);
  out += patchBlock("hover-guard", HOVER_GUARD_SCRIPT);
  out += patchBlock("drop-mention", DROP_SCRIPT);

  // 6. Append marker and derived record
  out += MARKER;
  out = withDerivedRecord(out, toRecord);

  return { ok: true, out, derivedCount: toRecord.length };
}

// Reverses full patches from webview.js string
function removeFromString(src) {
  let out = src;

  // 1. Reverse QoL transforms
  out = out.split(R1_REPL).join(R1_FIND).split(R2_REPL).join(R2_FIND);
  out = out.split(EXP_REPL).join(EXP_FIND).split(RS_REPL).join(RS_FIND);
  out = out.split(SAC_OPT_REPL).join(SAC_OPT_FIND).split(SAC_READY_REPL).join(SAC_READY_FIND);
  out = out.split(NPT_REPL).join(NPT_FIND);
  out = out.split(DRAGOVER_REPL).join(DRAGOVER_FIND);
  out = out.split(DVN_REPL).join(DVN_FIND);
  out = out.split(DROP_REPL).join(DROP_FIND);
  out = out.split(EVN_REPL).join(EVN_FIND);
  out = out.split(CLICK_REPL).join(CLICK_FIND);

  // 2. Reverse KB rules using recorded derivations
  const records = readDerivedRecord(out);
  for (const r of records) {
    if (r.patched && r.original && out.includes(r.patched)) {
      out = out.replace(r.patched, r.original);
    }
  }

  // 3. Strip script blocks and derived blocks
  out = stripPatchBlock(out, "chat-scroll");
  out = stripPatchBlock(out, "hover-guard");
  out = stripPatchBlock(out, "drop-mention");
  out = stripPatchBlock(out, "derived");

  // 4. Strip markers
  for (const m of OLD_MARKERS) out = out.split("\n" + m + "\n").join("");

  return out;
}


// ---- CSS transforms ----
function cssIsPatched(src) {
  return src.includes(CSS_MARKER);
}

function stripCss(src) {
  let cut = src.length;
  for (const m of CSS_OLD_MARKERS) {
    const i = src.indexOf(m);
    if (i >= 0 && i < cut) cut = i;
  }
  let out = src.slice(0, cut);
  out = stripPatchBlock(out, "chat-scroll");
  out = stripPatchBlock(out, "math-clip");
  out = stripPatchBlock(out, "math");
  out = stripPatchBlock(out, "raw-markdown");
  out = stripPatchBlock(out, "typography");
  return out;
}

function buildCssBlock(opts = {}) {
  const {
    fillChatWidth = true,
    chatMathRendering = true,
    chatMathFontSizeEm = 1.21,
    chatRawMarkdownButton = true,
    chatHistoryFontSizeEm = 1,
    chatHistoryFontFamily = "",
  } = opts;

  const rules = [];

  // QoL Chat Width & Prompt Input
  if (fillChatWidth) {
    rules.push(
      ".chat-view{--chat-readable-width:100% !important;--chat-gutter:16px !important;}",
      "@supports (field-sizing:content){.chat-view .prompt-input{field-sizing:content;height:auto !important;}}",
      // Tool cards (Trae styled)
      "[data-component=tool-part-wrapper]{border:none !important;box-shadow:none !important;outline:none !important;}",
      "[data-component=tool-part-wrapper] [data-slot=collapsible-trigger]{padding:9px 12px;gap:8px;}",
      "[data-component=tool-part-wrapper] [data-slot=collapsible-content]{padding:2px 12px 12px;}",
      "[data-component=tool-part-wrapper] [data-slot=collapsible-trigger]:hover{background:color-mix(in srgb,var(--surface-base) 80%,transparent);}",
      // Code blocks
      "[data-component=markdown-code]{border:none !important;box-shadow:none !important;outline:none !important;}",
      "[data-component=markdown-code] [data-slot=markdown-copy-button]{opacity:1;top:6px;right:6px;}",
      ".shiki{background:#0d1117;color:#e6edf3;padding:12px 14px;font-size:13px;line-height:1.55;}",
      ".shiki code{color:#e6edf3;}",
      ".shiki,.shiki span{--shiki-default:#e6edf3;--shiki-dark:#e6edf3;--shiki-light:#e6edf3;--shiki-default-bg:#0d1117;--shiki-dark-bg:#0d1117;--shiki-light-bg:#0d1117;}",
      // MCP tool-card transcript: headers/labels read as terminal prose, code blocks sit tight
      "[data-component=tool-part-wrapper] [data-component=markdown] p{font-family:var(--font-family-mono);font-size:12px;margin:4px 0 2px;opacity:.85;}",
      "[data-component=tool-part-wrapper] [data-component=markdown-code]{margin:6px 0 14px;border-radius:8px;overflow:hidden;}",
      // MCP Input/Output: no vertical scroll - lay the whole block out vertically, keep horizontal scroll only
      "[data-slot=mcp-section-label]+[data-component=tool-output],[data-component=tool-part-wrapper] [data-component=tool-output][data-variant=preview]{max-height:none !important;overflow:visible !important;scrollbar-width:auto !important;}",
      "[data-slot=mcp-section-label]+[data-component=tool-output]::-webkit-scrollbar,[data-component=tool-part-wrapper] [data-component=tool-output][data-variant=preview]::-webkit-scrollbar{display:block !important;width:0 !important;height:10px !important;}",
      "[data-component=tool-part-wrapper] [data-component=tool-output][data-scrollable]{max-height:none !important;overflow-y:visible !important;}",
      "[data-component=tool-part-wrapper] [data-component=tool-output]{margin-bottom:14px;gap:2px;}",
      "[data-component=tool-part-wrapper] [data-component=markdown-code] pre,[data-component=tool-part-wrapper] [data-component=markdown-code] code,[data-component=tool-part-wrapper] .shiki{overflow-x:auto !important;max-height:none !important;}"
    );
  }

  // KB Math clip
  rules.push(`${CHAT_ANY_MD} .katex { position: relative; }`);

  // KB Math size
  if (chatMathRendering && chatMathFontSizeEm && chatMathFontSizeEm !== 1.21) {
    rules.push(`${CHAT_ANY_MD} .katex { font-size: ${chatMathFontSizeEm}em; }`);
  }

  // KB Raw markdown
  if (chatRawMarkdownButton) {
    rules.push(...RAW_MARKDOWN_RULES);
  }

  // KB Typography (Font size & font family)
  const scale = Number(chatHistoryFontSizeEm) || 1;
  const family = (chatHistoryFontFamily || "").trim();
  if (scale !== 1 || family !== "") {
    if (scale !== 1) {
      rules.push(
        `${CHAT_ASSISTANT_MD} { font-size: calc(13px * ${scale}); }`,
        `${CHAT_ASSISTANT_MD} table { font-size: calc(13px * ${scale}); }`
      );
    }
    rules.push(...headingRules());
    rules.push(
      `${CHAT_ASSISTANT_MD} pre { font-size: 13px; }`,
      `${CHAT_ASSISTANT_MD} :not(pre) > code { font-size: 13px; }`,
      `${CHAT_ASSISTANT_MD} a.file-path-link { font-size: 13px; }`
    );
    if (family) {
      rules.push(`${CHAT_ASSISTANT_MD} { font-family: ${family}; }`);
    }
  }

  return CSS_MARKER + "\n" + rules.join("\n") + "\n";
}

function applyCss(src, opts = {}) {
  const clean = stripCss(src);
  return clean + buildCssBlock(opts);
}

function removeCss(src) {
  return stripCss(src);
}

// ---- extension.js (host) show-all-chats patch helpers ----
const HOST_MARKER = "\n//__KQP_HOST_v2__\n";
const HOST_OLD_MARKERS = ["//__KQP_HOST_v1__", "//__KQP_HOST_v2__"];

function hostIsPatched(src) {
  return HOST_OLD_MARKERS.some((m) => src.includes(m));
}
function hostIsCurrent(src) {
  return src.includes(HOST_MARKER.trim());
}
function applyHostToString(src) {
  const c1 = countOf(src, HOST_READY_FIND);
  const c2 = countOf(src, SESSION_DIRS_FIND);
  const c3 = countOf(src, REGISTER_SESSION_FIND);
  if (c1 !== 1 || c2 !== 1 || c3 !== 1) return { ok: false, c1, c2, c3 };
  const out =
    src
      .replace(HOST_READY_FIND, HOST_READY_REPL)
      .replace(SESSION_DIRS_FIND, SESSION_DIRS_REPL)
      .replace(REGISTER_SESSION_FIND, REGISTER_SESSION_REPL) + HOST_MARKER;
  return { ok: true, out, c1, c2, c3 };
}
function removeHostFromString(src) {
  let out = src.split(HOST_READY_REPL).join(HOST_READY_FIND);
  out = out.split(SESSION_DIRS_REPL).join(SESSION_DIRS_FIND);
  out = out.split(REGISTER_SESSION_REPL).join(REGISTER_SESSION_FIND);
  for (const m of HOST_OLD_MARKERS) out = out.split("\n" + m + "\n").join("");
  return out;
}

// ---- Kilo Code package.json title tweak ----
const OPEN_IN_TAB_TITLE_RE = /("title":\s*)"Open in Tab"/g;
function applyOpenInTabTitle(pkgPath, rename) {
  if (!fs.existsSync(pkgPath)) return false;
  const content = fs.readFileSync(pkgPath, "utf8");
  const desired = rename ? "Kilo Code: Open" : "Open in Tab";
  const updated = content.replace(OPEN_IN_TAB_TITLE_RE, `$1${JSON.stringify(desired)}`);
  if (updated !== content) {
    fs.writeFileSync(pkgPath, updated, "utf8");
    return true;
  }
  return false;
}

module.exports = {
  MARKER,
  OLD_MARKERS,
  R1_FIND,
  R1_REPL,
  R2_FIND,
  R2_REPL,
  EXP_FIND,
  EXP_REPL,
  RS_FIND,
  RS_REPL,
  SAC_OPT_FIND,
  SAC_OPT_REPL,
  SAC_READY_FIND,
  SAC_READY_REPL,
  NPT_FIND,
  NPT_REPL,
  DROP_FIND,
  DROP_REPL,
  EVN_FIND,
  EVN_REPL,
  CLICK_FIND,
  CLICK_REPL,
  HOST_READY_FIND,
  HOST_READY_REPL,
  SESSION_DIRS_FIND,
  SESSION_DIRS_REPL,
  REGISTER_SESSION_FIND,
  REGISTER_SESSION_REPL,
  HOST_MARKER,
  HOST_OLD_MARKERS,
  CSS_MARKER,
  CSS_OLD_MARKERS,
  countOf,
  isPatched,
  isCurrent,
  applyToString,
  removeFromString,
  readDerivedRecord,
  withDerivedRecord,
  hostIsPatched,
  hostIsCurrent,
  applyHostToString,
  removeHostFromString,
  cssIsPatched,
  applyCss,
  removeCss,
  applyOpenInTabTitle,
};
