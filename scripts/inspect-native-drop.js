const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const src = fs.readFileSync(wv, 'utf8');

const dvnIdx = src.indexOf('function DVn(');
console.log('=== DVn implementation ===');
console.log(src.slice(dvnIdx, dvnIdx + 600));

const gvnIdx = src.indexOf('function GVn(');
console.log('=== GVn implementation ===');
console.log(src.slice(gvnIdx, gvnIdx + 800));

const dropIdx = src.indexOf('w.setFilePathDropHandler(');
console.log('=== setFilePathDropHandler implementation ===');
console.log(src.slice(dropIdx, dropIdx + 600));
