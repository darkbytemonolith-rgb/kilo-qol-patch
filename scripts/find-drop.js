const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const bak = path.join(dist, 'webview.js.qolpatch.bak');
const clean = fs.readFileSync(bak, 'utf8');

console.log('Searching for drop handlers...');
// search for dataTransfer
let pos = 0;
while (true) {
  const idx = clean.indexOf('dataTransfer', pos);
  if (idx === -1) break;
  console.log('=== dataTransfer at', idx, '===');
  console.log(clean.slice(Math.max(0, idx - 150), Math.min(clean.length, idx + 250)));
  pos = idx + 12;
}

// search for setFilePathDropHandler
pos = 0;
while (true) {
  const idx = clean.indexOf('setFilePathDropHandler', pos);
  if (idx === -1) break;
  console.log('=== setFilePathDropHandler at', idx, '===');
  console.log(clean.slice(Math.max(0, idx - 150), Math.min(clean.length, idx + 350)));
  pos = idx + 22;
}
