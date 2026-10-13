const fs = require('fs');
const path = require('path');
const dist = path.join(process.env.USERPROFILE, '.vscode', 'extensions', 'kilocode.kilo-code-7.8.8-win32-x64', 'dist');
const wv = path.join(dist, 'webview.js');
const src = fs.readFileSync(wv, 'utf8');

// Find prt definition
const prtIdx = src.indexOf('function prt(') !== -1 ? src.indexOf('function prt(') : src.indexOf('prt=');
console.log('=== prt ===');
console.log(src.slice(prtIdx - 50, prtIdx + 600));

// Find insertDrop definition
const idIdx = src.indexOf('insertDrop:');
console.log('=== insertDrop ===');
console.log(src.slice(idIdx - 100, idIdx + 600));

// Find MVn definition
const mvnIdx = src.indexOf('function MVn(');
console.log('=== MVn ===');
console.log(src.slice(mvnIdx - 50, mvnIdx + 600));

// Find jAe definition
const jaeIdx = src.indexOf('function jAe(');
console.log('=== jAe ===');
console.log(src.slice(jaeIdx - 50, jaeIdx + 600));
