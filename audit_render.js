const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'produtos.html');
const source = fs.readFileSync(filePath, 'utf8');
const tok = 'async function renderizarProdutos() {';
const si = source.indexOf(tok);
if (si === -1) throw new Error('Start not found');

let brace = 0;
let inString = false;
let stringChar = '';
let esc = false;
let lineComment = false;
let blockComment = false;
let tpl = 0;

for (let i = si; i < source.length; i++) {
  const ch = source[i];
  const next = source[i + 1];

  if (lineComment) {
    if (ch === '\n') lineComment = false;
    continue;
  }
  if (blockComment) {
    if (ch === '*' && next === '/') {
      blockComment = false;
      i++;
    }
    continue;
  }
  if (inString) {
    if (esc) {
      esc = false;
    } else if (ch === '\\') {
      esc = true;
    } else if (ch === stringChar) {
      if (stringChar === '`' && tpl > 0) {
      } else {
        inString = false;
        stringChar = '';
      }
    } else if (stringChar === '`' && ch === '$' && next === '{') {
      tpl++;
      brace++;
      i++;
    }
    continue;
  }
  if (ch === '/' && next === '/') {
    lineComment = true;
    i++;
    continue;
  }
  if (ch === '/' && next === '*') {
    blockComment = true;
    i++;
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') {
    inString = true;
    stringChar = ch;
    esc = false;
    continue;
  }
  if (ch === '{') {
    brace++;
    continue;
  }
  if (ch === '}') {
    if (tpl > 0) {
      tpl--;
      brace--;
    } else {
      brace--;
      if (brace === 0) {
        const fn = source.slice(si, i + 1);
        const lines = fn.split('\n');
        console.log('=== Function extracted ===');
        console.log(`Total lines: ${lines.length}`);
        console.log('First 5 lines:');
        lines.slice(0, 5).forEach((l, idx) => console.log(`${idx + 1}: ${l}`));
        console.log('Last 5 lines:');
        lines.slice(-5).forEach((l, idx) => console.log(`${lines.length - 4 + idx}: ${l}`));
        process.exit(0);
      }
    }
    continue;
  }
}

console.error('End brace not found');
process.exit(1);
