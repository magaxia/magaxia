const fs = require('fs');
const html = fs.readFileSync('c:/Users/Kalebi/Desktop/Nova pasta/usuarios.html', 'utf8');
const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/g;
let match;
let count = 0;
while ((match = scriptRegex.exec(html)) !== null) {
  count += 1;
  if (match[1].trim()) {
    console.log('checking script', count, 'length:', match[1].length);
    try {
      new Function(match[1]);
      console.log('script', count, 'ok');
    } catch (e) {
      console.error('script', count, 'syntax error:', e.message);
      process.exit(1);
    }
  } else {
    console.log('script', count, 'empty, skipped');
  }
}
console.log('OK total scripts', count);
