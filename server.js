const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const DIR = 'c:\\Users\\Kalebi\\Downloads';

const mimeTypes = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.txt': 'text/plain',
  '.pdf': 'application/pdf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
};

const server = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  let pathname = `.${parsedUrl.pathname}`;

  if (pathname === './') {
    pathname = './index.html';
  }

  const filePath = path.join(DIR, pathname);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 - Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType + '; charset=utf-8');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR RODANDO!\n`);
  console.log(`📍 Acesse: http://localhost:${PORT}`);
  console.log(`📁 Pasta: ${DIR}\n`);
  console.log(`Páginas:`);
  console.log(`  • Login: http://localhost:${PORT}/login.html`);
  console.log(`  • Usuários: http://localhost:${PORT}/usuarios.html`);
  console.log(`  • Perfil: http://localhost:${PORT}/perfil.html`);
  console.log(`  • Produtos: http://localhost:${PORT}/produtos.html`);
  console.log(`  • Depósito: http://localhost:${PORT}/deposito.html`);
  console.log(`  • Saque: http://localhost:${PORT}/saque.html\n`);
  console.log(`Pressione Ctrl+C para parar\n`);
});
