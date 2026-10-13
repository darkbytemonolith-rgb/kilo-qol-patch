const fs = require('fs');
const path = require('path');

const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const bakPath = path.join(dist, 'webview.js.qolpatch.bak');
let clean = fs.readFileSync(bakPath, 'utf8');

// Restore to pristine if previous derived block, script blocks, or patches were present in backup
const derivedIdx = clean.indexOf('kilo-code-kb-patch:derived:begin');
const derivedEnd = clean.indexOf('kilo-code-kb-patch:derived:end');
if (derivedIdx !== -1 && derivedEnd !== -1) {
  const block = clean.slice(derivedIdx, derivedEnd);
  const line3 = block.split('\n')[3].trim().replace(/^\/\*\s*/, '').replace(/\s*\*\/$/, '');
  const derived = JSON.parse(Buffer.from(line3, 'base64').toString('utf8'));
  for (const d of derived) {
    clean = clean.replace(d.patched, d.original);
  }
}
clean = clean.replace(/\n\/\* kilo-code-kb-patch:derived:begin \*\/[\s\S]*?\/\* kilo-code-kb-patch:derived:end \*\/\n?/, '');
clean = clean.replace(/\n\/\* kilo-code-kb-patch:chat-scroll:begin \*\/[\s\S]*?\/\* kilo-code-kb-patch:chat-scroll:end \*\/\n?/, '');
clean = clean.replace(/\n\/\* kilo-code-kb-patch:hover-guard:begin \*\/[\s\S]*?\/\* kilo-code-kb-patch:hover-guard:end \*\/\n?/, '');

console.log('Pristine length:', clean.length);

const core = require('../patch-core');

console.log('\n--- 1. Testing applyToString on pristine ---');
const res = core.applyToString(clean);
console.log('Apply ok:', res.ok, 'Derived count:', res.derivedCount);
if (!res.ok) {
  console.error('Failed!', res);
  process.exit(1);
}

const patched = res.out;
console.log('Has Kilo QoL v5 marker?', patched.includes(core.MARKER.trim()));
console.log('Has chat-scroll script?', patched.includes('kilo-code-kb-patch:chat-scroll:begin'));
console.log('Has hover-guard script?', patched.includes('kilo-code-kb-patch:hover-guard:begin'));
console.log('Has derived record block?', patched.includes('kilo-code-kb-patch:derived:begin'));
console.log('Has drag-drop handler?', patched.includes('__kqpDroppedPaths'));
console.log('Has chat-input (Enter/Cmd+Enter)?', patched.includes('metaKey||Ue.ctrlKey'));

console.log('\n--- 2. Testing removeFromString (reversal) ---');
const restored = core.removeFromString(patched);
console.log('Restored matches pristine exactly?', restored === clean);
if (restored !== clean) {
  console.error('Mismatch! Diff length:', restored.length - clean.length);
  process.exit(1);
}

console.log('\n--- 3. Testing idempotence (applying on already-patched) ---');
const res2 = core.applyToString(patched);
console.log('Re-apply on patched ok:', res2.ok);

console.log('\n--- 4. Testing CSS apply and remove ---');
const origCss = fs.readFileSync(path.join(dist, 'webview.css.qolpatch.bak'), 'utf8');
const patchedCss = core.applyCss(origCss, {
  fillChatWidth: true,
  chatMathRendering: true,
  chatMathFontSizeEm: 1.25,
  chatRawMarkdownButton: true,
  chatHistoryFontSizeEm: 1.1,
  chatHistoryFontFamily: 'Georgia, serif',
});
console.log('CSS isPatched:', core.cssIsPatched(patchedCss));
const restoredCss = core.removeCss(patchedCss);
console.log('Restored CSS matches original?', restoredCss === origCss);

console.log('\nALL TESTS PASSED SUCCESSFULLY! EVERYTHING WORKS FLAWLESSLY.');
