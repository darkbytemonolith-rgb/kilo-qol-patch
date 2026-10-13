const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const src = fs.readFileSync(wv, 'utf8');

const itIdx = src.indexOf(',insertDrop:It');
console.log('=== insertDrop:It context ===');
console.log(src.slice(itIdx - 800, itIdx + 200));
