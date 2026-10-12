// Pure patch definitions + string transforms. No vscode dependency, so this can
// be unit-run with plain node. extension.js wraps this with VS Code UI.
//
// Two patches:
//   1. webview.js  -> render MCP tool-result images inline (one per row + path).
//   2. webview.css -> let chat content fill the panel width (remove the 98ch cap).

// ---- webview.js image patch ----
const MARKER = "\n//__MCPIMG_PATCH_v2__\n";
const OLD_MARKERS = ["//__MCPIMG_PATCH_v1__", "//__MCPIMG_PATCH_v2__"];

const R1_FIND = `=()=>e.tool==="board_post"||e.tool==="board_read",`;
const R1_REPL =
  `=()=>e.tool==="board_post"||e.tool==="board_read",` +
  `__mcpDlg=(()=>{try{return Ti()}catch(_e){return null}})(),` +
  `__mcpImgs=ye(()=>{var at=(e.attachments||[]).filter(z=>z&&typeof z.mime=="string"&&z.mime.startsWith("image/")&&z.url),ip=(e.input&&(Array.isArray(e.input.paths)?e.input.paths:(typeof e.input.path=="string"?[e.input.path]:[])))||[];return at.map((z,i)=>({url:z.url,alt:z.filename||ip[i]||("image "+(i+1)),label:z.filename||ip[i]||""}))}),`;

const IMG = `C(le,{get when(){return __mcpImgs().length>0},get children(){var G=document.createElement("div");G.setAttribute("data-component","mcp-images");G.style.display="flex";G.style.flexDirection="column";G.style.gap="10px";G.style.margin="6px 0";return P(G,C(Nt,{get each(){return __mcpImgs()},children:z=>{var W=document.createElement("div");W.style.display="flex";W.style.flexDirection="column";W.style.gap="4px";if(z.label){var L=document.createElement("div");L.textContent=z.label;L.style.fontFamily="var(--vscode-editor-font-family,monospace)";L.style.fontSize="11px";L.style.opacity="0.7";L.style.wordBreak="break-all";W.appendChild(L)}var M=document.createElement("img");M.src=z.url;M.alt=z.alt;M.style.maxWidth="100%";M.style.maxHeight="360px";M.style.borderRadius="6px";M.style.border="1px solid var(--vscode-panel-border,rgba(128,128,128,0.3))";M.style.cursor="zoom-in";M.style.objectFit="contain";M.style.alignSelf="flex-start";M.addEventListener("click",()=>{__mcpDlg&&__mcpDlg.show(()=>C(Cje,{src:z.url,alt:z.alt}))});W.appendChild(M);return W}})),G}})`;

const R2_FIND = `,C(le,{get when(){return o()},children:y=>(()=>{var v=Oka();`;
const R2_REPL =
  `,` + IMG + `,C(le,{get when(){return o()},children:y=>(()=>{var v=Oka();`;

// ---- webview.css chat-width patch ----
const CSS_MARKER = "/*__KQP_CSS_v1__*/";
const CSS_BLOCK =
  "\n" +
  CSS_MARKER +
  "\n.chat-view{--chat-readable-width:100% !important;--chat-gutter:16px !important;}\n";

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

function applyToString(src) {
  const c1 = countOf(src, R1_FIND);
  const c2 = countOf(src, R2_FIND);
  if (c1 !== 1 || c2 !== 1) return { ok: false, c1, c2 };
  const out = src.replace(R1_FIND, R1_REPL).replace(R2_FIND, R2_REPL) + MARKER;
  return { ok: true, out, c1, c2 };
}

function removeFromString(src) {
  let out = src.split(R1_REPL).join(R1_FIND).split(R2_REPL).join(R2_FIND);
  for (const m of OLD_MARKERS) out = out.split("\n" + m + "\n").join("");
  return out;
}

// CSS helpers
function cssIsPatched(src) {
  return src.includes(CSS_MARKER);
}
function applyCss(src) {
  if (src.includes(CSS_MARKER)) return src;
  return src + CSS_BLOCK;
}
function removeCss(src) {
  return src.split(CSS_BLOCK).join("");
}

module.exports = {
  MARKER,
  OLD_MARKERS,
  R1_FIND,
  R1_REPL,
  R2_FIND,
  R2_REPL,
  CSS_MARKER,
  CSS_BLOCK,
  countOf,
  isPatched,
  isCurrent,
  applyToString,
  removeFromString,
  cssIsPatched,
  applyCss,
  removeCss,
};
