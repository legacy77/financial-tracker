const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = 8000;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

const LEGACY_REDIRECTS = {
  '/01-guild-entrance.html': '/screens/01-guild-entrance.html',
  '/02-guild-hall.html': '/screens/02-guild-hall.html',
  '/03-inventory.html': '/screens/03-inventory.html',
  '/04-scroll-reading.html': '/screens/04-scroll-reading.html',
  '/00-register.html': '/screens/00-register.html'
};

function resolvePath(urlPath) {
  const clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0]);
  if (LEGACY_REDIRECTS[clean]) return { redirect: LEGACY_REDIRECTS[clean] };
  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '');
  // ponytail: static dev server only; production pakai static host + SPA fallback.
  const normalized = path.normalize(path.join(PUBLIC_DIR, rel));
  if (normalized !== PUBLIC_DIR && !normalized.startsWith(PUBLIC_DIR + path.sep)) return null;
  return { filePath: normalized };
}

// Bunyikan hanya jika benar-benar masalah app; DevTools & sourcemap = noise.
const SILENT_PATHS = new Set(['/favicon.ico']);
const SILENT_PREFIXES = ['/.well-known/', '/__nextjs', '/__next/'];
const SILENT_SUFFIXES = ['.map'];

const server = http.createServer((req, res) => {
  const rawUrl = (req.url || '/').split('?')[0].split('#')[0];
  if (SILENT_PATHS.has(rawUrl)) {
    res.writeHead(204);
    res.end();
    return;
  }
  if (SILENT_PREFIXES.some((p) => rawUrl.startsWith(p)) || SILENT_SUFFIXES.some((s) => rawUrl.toLowerCase().endsWith(s))) {
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();
    return;
  }

  if (rawUrl === '/api/data') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET') {
      if (!fs.existsSync(DATA_FILE)) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ exists: false }));
        return;
      }
      fs.readFile(DATA_FILE, 'utf8', (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          const tmpFile = DATA_FILE + '.tmp';
          fs.writeFileSync(tmpFile, JSON.stringify(parsed, null, 2), 'utf8');
          fs.renameSync(tmpFile, DATA_FILE);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }

  if (rawUrl === '/api/hash-pin') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'POST') {
      let body = '';
      req.on('data', (chunk) => { body += chunk; });
      req.on('end', () => {
        try {
          const { pin, salt } = JSON.parse(body);
          if (!pin || !salt) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'pin and salt required' }));
            return;
          }
          const hash = crypto.pbkdf2Sync(String(pin), Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex');
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ hash }));
        } catch (err) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: err.message }));
        }
      });
      return;
    }

    res.writeHead(405, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Method not allowed' }));
    return;
  }
  const resolved = resolvePath(req.url || '/');
  if (resolved && resolved.redirect) {
    res.writeHead(302, { Location: resolved.redirect });
    res.end();
    return;
  }
  const filePath = resolved && resolved.filePath;
  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/html' });
    res.end('<h1>403 Forbidden</h1>', 'utf-8');
    return;
  }
  const extname = path.extname(filePath);
  const contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        console.warn(`[404] ${req.url}`);
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>404 Not Found</h1><p>Halaman <code>' + req.url + '</code> tidak ditemukan. <a href="/">Kembali ke Home</a></p>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, () => {
  console.log(`🚀 KelolaRacun running at http://localhost:${PORT}`);
});
