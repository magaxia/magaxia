const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = 8000;
const DIR = path.join(__dirname);

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
  let pathname = parsedUrl.pathname || '/';

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (pathname === '/api/geo') {
    return handleGeoRequest(req, res);
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  if (pathname.includes('..')) {
    res.statusCode = 400;
    res.end('Bad request');
    return;
  }

  const filePath = path.join(DIR, pathname);
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.end('<h1>404 - Not Found</h1>');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.statusCode = 200;
    res.setHeader('Content-Type', `${contentType}; charset=utf-8`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
    stream.on('error', error => {
      console.error('Erro ao ler arquivo:', error);
      res.statusCode = 500;
      res.end('Internal Server Error');
    });
  });
});

function handleGeoRequest(req, res) {
  const remoteIp = req.socket.remoteAddress || '127.0.0.1';
  const apiUrl = 'https://ipapi.co/json/';

  https.get(apiUrl, apiRes => {
    let rawData = '';
    apiRes.on('data', chunk => rawData += chunk);
    apiRes.on('end', () => {
      try {
        const parsed = JSON.parse(rawData);
        const payload = {
          ip: parsed.ip || remoteIp,
          country: parsed.country || parsed.country_name || 'desconhecido',
          country_name: parsed.country_name || parsed.country || 'desconhecido',
          region: parsed.region || '',
          city: parsed.city || '',
          org: parsed.org || parsed.org_name || ''
        };
        res.statusCode = 200;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify(payload));
      } catch (error) {
        console.error('Erro ao parsear resposta geo:', error);
        sendGeoFallback(res, remoteIp);
      }
    });
  }).on('error', error => {
    console.warn('Erro ao chamar api geo:', error);
    sendGeoFallback(res, remoteIp);
  });
}

function sendGeoFallback(res, remoteIp) {
  const payload = {
    ip: remoteIp,
    country: 'desconhecido',
    country_name: 'desconhecido',
    region: '',
    city: '',
    org: ''
  };
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

server.listen(PORT, () => {
  console.log(`\n✅ SERVIDOR RODANDO!\n`);
  console.log(`📍 Acesse: http://localhost:${PORT}`);
  console.log(`📁 Pasta: ${DIR}\n`);
  console.log('Páginas:');
  console.log(`  • Login: http://localhost:${PORT}/login.html`);
  console.log(`  • Perfil: http://localhost:${PORT}/perfil.html`);
  console.log(`  • Depósito: http://localhost:${PORT}/deposito.html`);
  console.log(`  • Saque: http://localhost:${PORT}/saque.html`);
  console.log(`  • Painel: http://localhost:${PORT}/painel.html`);
  console.log(`  • Dashboard: http://localhost:${PORT}/index.html\n`);
  console.log('Pressione Ctrl+C para parar\n');
});
