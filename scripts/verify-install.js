const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const css = path.join(dist, 'webview.css');
const bak = wv + '.qolpatch.bak';
const core = require('../patch-core');

console.log('--- Applying to installed Kilo Code ---');
let src = fs.existsSync(bak) ? fs.readFileSync(bak, 'utf8') : fs.readFileSync(wv, 'utf8');
if (!fs.existsSync(bak)) fs.writeFileSync(bak, src, 'utf8');
const res = core.applyToString(src);
console.log('applyToString ok:', res.ok, 'derivedCount:', res.derivedCount);
if (!res.ok) {
  console.error('Apply failed:', res);
  process.exit(1);
}

fs.writeFileSync(wv, res.out, 'utf8');
console.log('Wrote patched webview.js');

let cssSrc = fs.readFileSync(css, 'utf8');
let newCss = core.applyCss(cssSrc);
fs.writeFileSync(css, newCss, 'utf8');
console.log('Wrote patched webview.css');

console.log('\n--- Verifying installed webview.js features ---');
const out = fs.readFileSync(wv, 'utf8');
const checks = [
  ['Marker v6', out.includes('//__KILO_QOL_PATCH_v6__')],
  ['Enter/Cmd+Enter', out.includes('metaKey||Ue.ctrlKey')],
  ['Smart Escape', out.includes('!Ue.shiftKey&&Ue.target?.value?.trim()')],
  ['Mention Escape', out.includes('ft[Oe.at]!=="@"')],
  ['History Recall (Cmd+Up/Down)', out.includes('Ue.key==="ArrowUp"?0:Y().length')],
  ['Permission Safety', out.includes('te.target?.value?.trim()')],
  ['Antigravity Drag & Drop Copy', out.includes('dropEffect="copy"')],
  ['Drop Global Interceptor', out.includes('window.__kqpDropInstalled')],
  ['Clean drag & drop mentions', out.includes('window.__kqpDroppedPaths')],
  ['Math KaTeX ($...$ and \\[...\\])', out.includes('kbpKatexInlineDollar')],
  ['Raw Markdown Toggle', out.includes('kbp-raw-markdown')],
  ['MCP inline images', out.includes('mcp-images')],
  ['Auto-expanded cards', out.includes('get defaultOpen(){return !0}')],
  ['Show all chats', out.includes('window.__kiloQolShowAllChats')],
  ['Chat-scroll pinned script', out.includes('kilo-code-kb-patch:chat-scroll:begin')],
  ['Hover guard script', out.includes('kilo-code-kb-patch:hover-guard:begin')],
];

let allPassed = true;
for (const [name, passed] of checks) {
  console.log(`- ${name.padEnd(32)}: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) allPassed = false;
}

console.log('\n--- Verifying installed webview.css features ---');
const cssOut = fs.readFileSync(css, 'utf8');
const cssChecks = [
  ['CSS Marker v5', cssOut.includes('/*__KQP_CSS_v5__*/')],
  ['Trae tool cards', cssOut.includes('[data-component=tool-part-wrapper]')],
  ['Code block styling', cssOut.includes('.shiki{background:#0d1117')],
  ['Full chat width', cssOut.includes('--chat-readable-width:100%')],
  ['Field-sizing input', cssOut.includes('field-sizing:content')],
  ['Math clip rule', cssOut.includes('.katex { position: relative; }')],
  ['Raw markdown CSS', cssOut.includes('data-kbp-raw-markdown')],
];

for (const [name, passed] of cssChecks) {
  console.log(`- ${name.padEnd(32)}: ${passed ? 'PASSED' : 'FAILED'}`);
  if (!passed) allPassed = false;
}

if (allPassed) {
  console.log('\nSUCCESS! 100% OF FEATURES VERIFIED AND ACTIVE ON LIVE INSTALLATION!');
} else {
  console.error('\nSome checks failed!');
  process.exit(1);
}
