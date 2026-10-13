const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const bak = path.join(dist, 'webview.js.qolpatch.bak');
const clean = fs.readFileSync(bak, 'utf8');

// Inspect GVn definition
const gvnIdx = clean.indexOf('function GVn(') !== -1 ? clean.indexOf('function GVn(') : clean.indexOf('GVn=');
console.log('=== GVn ===');
console.log(clean.slice(gvnIdx - 50, gvnIdx + 800));

// Inspect DVn definition
const dvnIdx = clean.indexOf('function DVn(') !== -1 ? clean.indexOf('function DVn(') : clean.indexOf('DVn=');
console.log('=== DVn ===');
console.log(clean.slice(dvnIdx - 50, dvnIdx + 800));

// Inspect how w (result of GVn()) is used in the prompt component
const wIdx = clean.indexOf('w=GVn()');
console.log('=== w=GVn() context ===');
console.log(clean.slice(wIdx - 100, wIdx + 1500));
