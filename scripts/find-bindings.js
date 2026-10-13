const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const src = fs.readFileSync(wv, 'utf8');

let pos = 0;
while (true) {
  const idx = src.indexOf('.handleDrop', pos);
  if (idx === -1) break;
  console.log('=== .handleDrop at', idx, '===');
  console.log(src.slice(Math.max(0, idx - 150), Math.min(src.length, idx + 250)));
  pos = idx + 11;
}

pos = 0;
while (true) {
  const idx = src.indexOf('.handleDragOver', pos);
  if (idx === -1) break;
  console.log('=== .handleDragOver at', idx, '===');
  console.log(src.slice(Math.max(0, idx - 150), Math.min(src.length, idx + 250)));
  pos = idx + 15;
}
