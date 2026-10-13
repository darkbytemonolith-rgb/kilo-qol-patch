const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const src = fs.readFileSync(wv, 'utf8');

console.log(src.slice(22577000, 22578500));
