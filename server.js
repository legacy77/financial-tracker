const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

const PORT = Number(process.env.PORT) || 8000;
const HOST = process.env.HOST || '127.0.0.1';
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const PUBLIC_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'db.json');
const REQUIRED_STORES = ['guilds', 'members', 'pouches', 'transactions', 'bills', 'gamification', 'categories', 'imports', 'budgets'];
const ALLOWED_HOSTS = new Set(['localhost', '127.0.0.1', HOST].map((value) => value.toLowerCase()));

function isAllowedApiHost(req) {
  const hostHeader = String(req.headers.host || '').toLowerCase().replace(/:\d+$/, '');
  return ALLOWED_HOSTS.has(hostHeader);
}

function validateAndSanitizeSnapshot(snapshot) {
  if (!snapshot || Array.isArray(snapshot) || typeof snapshot !== 'object' || !Number.isInteger(snapshot.version) || !snapshot.stores || Array.isArray(snapshot.stores) || typeof snapshot.stores !== 'object') return null;
  for (const store of REQUIRED_STORES) {
    if (!Array.isArray(snapshot.stores[store])) return null;
    if (snapshot.stores[store].some((record) => !record || Array.isArray(record) || typeof record !== 'object' || typeof record.id !== 'string' || !record.id)) return null;
  }
  const sanitized = { ...snapshot, stores: { ...snapshot.stores } };
  sanitized.stores.members = sanitized.stores.members.map(({ pinSalt, pinHash, ...member }) => member);
  return sanitized;
}

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

function readPackageVersion() {
  try {
    const packageJson = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    return packageJson.version || 'dev';
  } catch (err) {
    return 'dev';
  }
}

// Path sensitif yang tidak boleh dilayani static handler (denylist eksplisit).
// Dicek case-insensitive karena Windows filesystem tidak case-sensitive (/DATA/db.json).
const BLOCKED_PREFIXES = ['data', '.git', '.opencode', 'docs', 'template'];
const BLOCKED_FILES = ['server.js', 'readme.md', 'package.json', 'package-lock.json', 'opencode.json', 'todo.md'];
const BLOCKED_SUFFIXES = ['.tmp', '.log'];

/**
 * Cek path relatif (sudah dinormalisasi) terhadap denylist sensitif
 */
function isBlockedRel(relPath) {
  const rel = relPath.split(path.sep).map((part) => part.toLowerCase());
  if (rel.some((part) => part.includes('\0'))) return true;
  const base = rel[rel.length - 1] || '';
  if (BLOCKED_FILES.includes(rel[0])) return true;
  if (BLOCKED_PREFIXES.includes(rel[0])) return true;
  if (BLOCKED_SUFFIXES.some((suffix) => base.endsWith(suffix))) return true;
  return false;
}

/**
 * Resolve URL ke file statis.
 * Hasil: { redirect } | { filePath } | { badRequest } | { forbidden } | null (404)
 */
function resolvePath(urlPath) {
  let clean
  try {
    clean = decodeURIComponent(urlPath.split('?')[0].split('#')[0])
  } catch (err) {
    // URI malformed (mis. /%c0%ae%c0%ae/...) — jangan sampai crash
    return { badRequest: true }
  }
  if (clean.includes('\0')) return { badRequest: true }
  if (clean.length > 1024) return { badRequest: true }

  const rel = clean === '/' ? 'index.html' : clean.replace(/^\/+/, '')
  // ponytail: static dev server only; production pakai static host + SPA fallback.
  const normalized = path.normalize(path.join(PUBLIC_DIR, rel))
  const relFromRoot = path.relative(PUBLIC_DIR, normalized)

  // Denylist dicek sebelum guard traversal dan sebelum LEGACY_REDIRECTS
  if (isBlockedRel(relFromRoot)) return { forbidden: true }

  if (LEGACY_REDIRECTS[clean]) return { redirect: LEGACY_REDIRECTS[clean] }
  if (normalized !== PUBLIC_DIR && !normalized.startsWith(PUBLIC_DIR + path.sep)) return null

  return { filePath: normalized }
}

// Bunyikan hanya jika benar-benar masalah app; DevTools & sourcemap = noise.
const SILENT_PATHS = new Set(['/favicon.ico']);
const SILENT_PREFIXES = ['/.well-known/', '/__nextjs', '/__next/'];
const SILENT_SUFFIXES = ['.map'];

// ANSI warna aman: aktif hanya di TTY tanpa NO_COLOR (supaya piped/CI log bersih)
const USE_COLOR = process.stdout.isTTY && !process.env.NO_COLOR;

/**
 * Format byte ke human readable (KB, MB, GB) — input invalid fallback '0 B'
 */
function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.max(0, Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1));
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

// Self-check internal sekali saat start; hasil tak perlu dicetak
(function selfCheckFormatBytes() {
  const cases = [
    [0, '0 B'],
    [1024, '1.0 KB'],
    [1024 ** 2, '1.0 MB'],
    [NaN, '0 B'],
    [Infinity, '0 B'],
    [-5, '0 B']
  ];
  for (const [input, expected] of cases) {
    if (formatBytes(input) !== expected) {
      console.warn(`self-check formatBytes gagal: input ${input}, harap "${expected}", dapat "${formatBytes(input)}"`);
    }
  }
})();

/**
 * Ambil IPv4 non-internal dari network interfaces untuk akses LAN (dedup)
 */
function getLanIps() {
  const nets = os.networkInterfaces();
  const ips = new Set();
  for (const name of Object.keys(nets)) {
    for (const iface of nets[name]) {
      if (iface.family === 'IPv4' && !iface.internal) {
        ips.add(iface.address);
      }
    }
  }
  return [...ips];
}

/**
 * Info database (db.json) — bungkus try/catch agar tidak gagalkan startup
 */
function getDbInfo() {
  const info = { exists: false, size: 0, records: {}, modified: null, version: null, updatedAt: null, error: null };
  try {
    if (!fs.existsSync(DATA_FILE)) return info;
    const stat = fs.statSync(DATA_FILE);
    info.exists = true;
    info.size = stat.size;
    info.modified = stat.mtime;
    try {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const db = JSON.parse(raw);
      info.version = db.version ?? null;
      info.updatedAt = db.updatedAt ?? null;
      const stores = db.stores || {};
      for (const key of Object.keys(stores)) {
        const val = stores[key];
        if (Array.isArray(val)) info.records[key] = val.length;
      }
    } catch (err) {
      info.error = err.message;
    }
  } catch (err) {
    info.error = err.message;
  }
  return info;
}

/**
 * Scan satu pohon direktori secara rekursif: hitung file & byte.
 * SKIP_DIRS diabaikan di semua level; error traversal dicatat, bukan digagalkan.
 */
const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SKIP_FILE_EXTS = new Set(['.err', '.log']);
function scanTree(dir, isRoot = false) {
  const stat = { files: 0, bytes: 0, errors: 0, topDirs: [], capped: false };
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (err) {
    stat.errors++;
    return stat;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    try {
      if (entry.isDirectory()) {
        if (SKIP_DIRS.has(entry.name)) continue;
        const child = scanTree(full);
        stat.files += child.files;
        stat.bytes += child.bytes;
        stat.errors += child.errors;
        stat.capped ||= child.capped;
        if (isRoot) {
          stat.topDirs.push({ name: entry.name + '/', files: child.files, bytes: child.bytes, errors: child.errors });
        }
      } else if (entry.isFile() && !SKIP_FILE_EXTS.has(path.extname(entry.name).toLowerCase())) {
        stat.files++;
        stat.bytes += fs.statSync(full).size;
      }
    } catch (err) {
      stat.errors++;
    }
  }
  return stat;
}

/**
 * Ringkasan static asset: global total + rincian per top-level dir,
 * keduanya dari satu hasil scanTree() supaya konsisten.
 */
function countStaticAssets() {
  const global = scanTree(PUBLIC_DIR, true);
  return { count: global.files, bytes: global.bytes, errors: global.errors, capped: global.capped, topDirs: global.topDirs };
}

// Buang escape ANSI sebelum mengukur lebar tampak
const ANSI_RE = /\x1b\[[0-9;]*m/g;
const stripAnsi = (s) => s.replace(ANSI_RE, '');

// Lebar kolom terminal: emoji = 2 kolom, combining/selector = 0, sisanya 1
const EMOJI_RE = /[\u{1F000}-\u{1FAFF}]/u;
const EMOJI_SYMBOL_RE = /[\u{2600}-\u{27BF}]/u;
const ZERO_WIDTH_RE = /[\u0300-\u036F\uFE00-\uFE0F\u200D]/u;
function displayWidth(text) {
  const chars = [...stripAnsi(text)];
  let w = 0;
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ZERO_WIDTH_RE.test(ch)) continue;
    if (EMOJI_RE.test(ch) || (EMOJI_SYMBOL_RE.test(ch) && chars[i + 1] === '\uFE0F')) w += 2;
    else w++;
  }
  return w;
}

// Lebar isi di antara border kiri/kanan (border box-drawing masing-masing 1 kolom)
const BOX_WIDTH = 80;
// Bungkus teks visible per lebar kotak; ANSI tidak ikut terpotong karena diukur setelah strip.
// Kata lebih panjang dari sisa kolom dipindah utuh ke baris berikut (wrap, bukan truncate).
function wrapVisible(text, width) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const word of words) {
    const candidate = cur === '' ? word : cur + ' ' + word;
    if (displayWidth(candidate) <= width) {
      cur = candidate;
    } else {
      if (cur !== '') lines.push(cur);
      // kata sendiri masih kepanjangan: potong per karakter sebagai last resort
      let rest = word;
      while (displayWidth(rest) > width) {
        let piece = '';
        for (const ch of rest) {
          if (displayWidth(piece + ch) > width) break;
          piece += ch;
        }
        lines.push(piece);
        rest = rest.slice(piece.length);
      }
      cur = rest;
    }
  }
  lines.push(cur);
  return lines;
}

/**
 * Cetak banner startup kaya informasi — semua baris lewat helper kotak yang sama
 */
function printStartupBanner() {
  const pkgVersion = readPackageVersion();
  const c = {
    reset: USE_COLOR ? '\x1b[0m' : '',
    bold: USE_COLOR ? '\x1b[1m' : '',
    dim: USE_COLOR ? '\x1b[2m' : '',
    red: USE_COLOR ? '\x1b[31m' : '',
    green: USE_COLOR ? '\x1b[32m' : '',
    yellow: USE_COLOR ? '\x1b[33m' : '',
    blue: USE_COLOR ? '\x1b[34m' : '',
    cyan: USE_COLOR ? '\x1b[36m' : '',
    gray: USE_COLOR ? '\x1b[90m' : '',
    magenta: USE_COLOR ? '\x1b[35m' : ''
  };

  // Rakitan kotak: border kiri '║ ', isi dipad sampai BOX_WIDTH, border kanan ' ║'
  const edge = `${c.bold}${c.magenta}`;
  const bar = '═'.repeat(BOX_WIDTH + 2);
  const boxTop = () => `${edge}╔${bar}╗${c.reset}`;
  const boxSep = () => `${edge}╠${bar}╣${c.reset}`;
  const boxBottom = () => `${edge}╚${bar}╝${c.reset}`;

  function boxLine(text) {
    const w = displayWidth(text);
    if (w > BOX_WIDTH) {
      return wrapVisible(text, BOX_WIDTH).map(boxLine).join('\n');
    }
    const content = text.padEnd(text.length + BOX_WIDTH - w);
    return `${edge}║${c.reset} ${content} ${edge}║${c.reset}`;
  }
  const boxSection = (title) => boxLine(` ${c.bold}${title}${c.reset}`);

  // Ambil informasi runtime
  const now = new Date();
  const startTime = now.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' (WIB)';
  const startIso = now.toISOString();
  const nodeVer = process.version;
  const platform = `${os.platform()} ${os.arch()}`;
  const pid = process.pid;
  const hostname = os.hostname();
  const lanIps = getLanIps();

  // Data store
  const db = getDbInfo();
  const dbSizeStr = formatBytes(db.size);
  const dbRecords = Object.entries(db.records).map(([k, v]) => `${k}: ${v}`).join(', ') || '—';
  const dbStatus = db.exists
    ? `${c.green}Ada${c.reset} (${dbSizeStr}, ${dbRecords})`
    : `${c.yellow}Belum ada (fresh install)${c.reset}`;
  const dbModified = db.modified ? db.modified.toLocaleString('id-ID') : '—';
  const dbVersion = db.version ?? '—';
  const dbUpdatedAt = db.updatedAt ? new Date(db.updatedAt).toLocaleString('id-ID') : '—';
  const dbError = db.error ? `${c.red}parse error: ${db.error}${c.reset}` : '';

  // Static assets — suffix 'partial' bila traversal ada yang gagal
  const assets = countStaticAssets();
  const assetsSizeStr = formatBytes(assets.bytes);
  const partialSuffix = assets.errors > 0 ? ` ${c.yellow}(partial, ${assets.errors} error)${c.reset}` : '';
  const topDirsStr = assets.topDirs
    .map(d => `${c.cyan}${d.name}${c.reset} (${d.files} file, ${formatBytes(d.bytes)})`)
    .join(', ') || '—';

  // Route map
  const routeLines = [
    `  ${c.bold}GET${c.reset}  /                    → index.html (Entrance / Login)`,
    `  ${c.bold}GET${c.reset}  /screens/*           → Static screens (01-entrance, 02-hall, dst)`,
    `  ${c.bold}GET${c.reset}  /health              → JSON liveness status`,
    `  ${c.bold}GET${c.reset}  /api/data            → Baca seluruh db.json`,
    `  ${c.bold}POST${c.reset} /api/data            → Tulis db.json (atomic)`,
    `  ${c.bold}GET${c.reset}  /* (legacy)          → ${Object.keys(LEGACY_REDIRECTS).length} redirect 302 ke /screens/*`
  ];

  // LAN access lines
  const lanLines = lanIps.length > 0
    ? lanIps.map(ip => `    ${c.green}http://${ip}:${PORT}${c.reset} ${c.gray}(akses dari HP/tablet di jaringan yang sama)${c.reset}`)
    : [`    ${c.yellow}Tidak terdeteksi IPv4 LAN aktif${c.reset}`];

  // Command hints
  const hints = [
    `  ${c.bold}Stop server:${c.reset}      Ctrl+C`,
    `  ${c.bold}Reset database:${c.reset}   Hapus file data/db.json (server akan buat ulang otomatis)`,
    `  ${c.bold}Login default:${c.reset}    Buka http://localhost:${PORT} → klik "🚀 Buat Guild & Masuk" untuk onboarding wizard`,
    `  ${c.bold}Multi-device sync:${c.reset} Gunakan URL LAN di atas dari perangkat lain di Wi-Fi yang sama`,
    `  ${c.bold}Log mode:${c.reset}         Ringkas — 404 ditampilkan, static/asset diam (SILENT_*)`
  ];

  const lines = [
    boxTop(),
    boxLine(`  ${c.bold}${c.cyan}🏰 KelolaRacun${c.reset} ${c.bold}v${pkgVersion}${c.reset}  —  ${c.dim}Family Finance Hub • Local Sync Server${c.reset}`),
    boxLine(`  ${c.dim}"Kelola racun-mu, raih goal-mu! Karena ngatur duit keluarga tuh seru, bukan beban."${c.reset}`),
    boxSep(),
    boxSection('Runtime'),
    boxLine(`  Node        : ${c.green}${nodeVer}${c.reset}`),
    boxLine(`  Platform    : ${c.green}${platform}${c.reset}`),
    boxLine(`  PID         : ${c.green}${pid}${c.reset}`),
    boxLine(`  Hostname    : ${c.green}${hostname}${c.reset}`),
    boxLine(`  Started     : ${c.green}${startTime}${c.reset}  ${c.dim}(${startIso})${c.reset}`),
    boxLine(`  Mode        : ${c.green}Dev Static Server${c.reset} (single-file, stdlib only)`),
    boxSep(),
    boxSection('Network & Akses'),
    boxLine(`  Local       : ${c.green}http://localhost:${PORT}${c.reset}`),
    boxLine(`  LAN         :`),
    ...lanLines.map(boxLine),
    boxSep(),
    boxSection(`Data Store (${DATA_FILE})`),
    boxLine(`  Status      : ${dbStatus}`),
    ...(dbError ? [boxLine(`                ${dbError}`)] : []),
    boxLine(`  Modified    : ${c.green}${dbModified}${c.reset}`),
    boxLine(`  Sync DB Version : ${c.green}${dbVersion}${c.reset}  |  UpdatedAt: ${c.green}${dbUpdatedAt}${c.reset}`),
    boxSep(),
    boxSection('Route Map'),
    ...routeLines.map(boxLine),
    boxSep(),
    boxSection('Static Assets'),
    boxLine(`  Total       : ${c.green}${assets.count} file${assets.capped ? '+' : ''}${c.reset}  |  Size: ${c.green}${assetsSizeStr}${c.reset}${partialSuffix}`),
    boxLine(`  Top-level   : ${topDirsStr}`),
    boxSep(),
    boxSection('Quick Commands'),
    ...hints.map(boxLine),
    boxSep(),
    boxLine(` ${c.green}✓ READY${c.reset}  —  Server listening on ${c.bold}:${PORT}${c.reset}  |  Entry: ${c.bold}/${c.reset}  |  Log: ${c.bold}404 only${c.reset}`),
    boxBottom()
  ];

  console.log('\n' + lines.join('\n') + '\n');
}

/**
 * Allowlist origin CORS: localhost, IP LAN sendiri (dihitung saat startup), host request itu sendiri
 * Origin asing tidak mendapat header CORS sama sekali (bukan '*', bukan echo)
 */
const ALLOWED_ORIGINS = new Set(
  getLanIps().flatMap((ip) => [`http://${ip}:${PORT}`, `https://${ip}:${PORT}`])
)

function getAllowedOrigin(req) {
  const origin = req.headers.origin
  // Request tanpa Origin (curl, sync service, navigasi biasa) tetap boleh jalan
  if (!origin) return null
  const lower = origin.toLowerCase()
  if (ALLOWED_ORIGINS.has(lower)) return origin
  if (lower === `http://localhost:${PORT}` || lower === `http://127.0.0.1:${PORT}`) return origin
  if (lower === `https://localhost:${PORT}` || lower === `https://127.0.0.1:${PORT}`) return origin
  // Same-origin: host Origin harus persis host header request
  try {
    if (req.headers.host && new URL(origin).host.toLowerCase() === String(req.headers.host).toLowerCase()) {
      return origin
    }
  } catch (err) {
    return null
  }
  return null
}

/**
 * Pasang header CORS; true jika origin diizinkan (atau tanpa Origin)
 */
function applyCors(req, res, methods) {
  const origin = getAllowedOrigin(req)
  res.setHeader('Access-Control-Allow-Methods', methods)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Vary', 'Origin')
  if (!origin) return !req.headers.origin
  res.setHeader('Access-Control-Allow-Origin', origin)
  return true
}


// Guard agar write db.json tidak tumpang tindih (POST /api/data bersamaan)
let dbWriteInFlight = false

const server = http.createServer((req, res) => {
  try {
    handleRequest(req, res)
  } catch (err) {
    // Jaring pengaman: satu request error tidak boleh mematikan proses
    console.error(`[500] ${req.url} — ${err.message}`)
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Internal server error' }))
    } else {
      res.end()
    }
  }
})

function handleRequest(req, res) {
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

  if (rawUrl === '/health') {
    res.setHeader('Cache-Control', 'no-store');
    if (!applyCors(req, res, 'GET, OPTIONS')) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }
    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }
    if (req.method !== 'GET') {
      res.writeHead(405, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Method not allowed' }));
      return;
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    const memory = process.memoryUsage();
    res.end(JSON.stringify({ status: 'ok', online: true, uptimeSeconds: process.uptime(), timestamp: new Date().toISOString(), port: PORT, pid: process.pid, memory: { rssBytes: memory.rss }, uptime: process.uptime(), version: readPackageVersion() }));
    return;
  }

  if (rawUrl === '/api/data') {
    if (!isAllowedApiHost(req)) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Host not allowed' }));
      return;
    }
    if (!applyCors(req, res, 'GET, POST, OPTIONS')) {
      // Origin asing: tutup akses, jangan membocorkan data
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Origin not allowed' }));
      return;
    }

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
          console.error(`[500] GET /api/data — ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(data);
      });
      return;
    }

    if (req.method === 'POST') {
      const chunks = [];
      let bodyBytes = 0;
      let bodyTooLarge = false;
      req.on('data', (chunk) => {
        if (bodyTooLarge) return;
        chunks.push(chunk);
        bodyBytes += chunk.length;
        if (bodyBytes > MAX_BODY_BYTES) {
          bodyTooLarge = true;
          res.writeHead(413, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Payload too large' }));
          req.destroy();
        }
      });
      req.on('end', () => {
        if (bodyTooLarge) return;
        if (dbWriteInFlight) {
          res.writeHead(409, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Write in progress, ulangi sebentar lagi' }));
          return;
        }
        let parsed;
        try {
          const body = Buffer.concat(chunks).toString('utf8');
          parsed = JSON.parse(body);
        } catch (err) {
          console.error(`[400] POST /api/data parse — ${err.message}`);
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid JSON payload' }));
          return;
        }
        const sanitized = validateAndSanitizeSnapshot(parsed);
        if (!sanitized) {
          console.error('[400] POST /api/data validation — invalid snapshot shape');
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid snapshot' }));
          return;
        }
        // Nama tmp unik per request + lock, supaya dua POST bersamaan tidak saling timpa
        const tmpFile = `${DATA_FILE}.${process.pid}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
        dbWriteInFlight = true;
        try {
          fs.writeFileSync(tmpFile, JSON.stringify(sanitized, null, 2), 'utf8');
          fs.renameSync(tmpFile, DATA_FILE);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ ok: true, updatedAt: new Date().toISOString() }));
        } catch (err) {
          try {
            if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
          } catch (cleanupErr) {
            // abaikan: file tmp mungkin sudah terhapus/terkunci
          }
          console.error(`[500] POST /api/data write — ${err.message}`);
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Internal server error' }));
        } finally {
          dbWriteInFlight = false;
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
  if (resolved && resolved.badRequest) {
    // URI malformed / null byte / terlalu panjang — balas 400 generik, server tetap hidup
    res.writeHead(400, { 'Content-Type': 'text/html' });
    res.end('<h1>400 Bad Request</h1>', 'utf-8');
    return;
  }
  const filePath = resolved && resolved.filePath;
  if (!filePath) {
    // Denylist maupun traversal balas 403 generik: tidak membocorkan keberadaan file
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
        res.end('<h1>404 Not Found</h1><p>Halaman tidak ditemukan. <a href="/">Kembali ke Home</a></p>', 'utf-8');
      } else {
        res.writeHead(500);
        res.end('Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n${USE_COLOR ? '\x1b[31m' : ''}✗ Port ${PORT} sudah digunakan (EADDRINUSE)${USE_COLOR ? '\x1b[0m' : ''}`);
    console.error(`  Proses lain mungkin sudah menjalankan KelolaRacun atau server lain di port ${PORT}.`);
    console.error(`  Solusi:`);
    console.error(`    - Stop proses yang pakai port ${PORT} (Task Manager / netstat -ano | findstr :${PORT})`);
    console.error(`    - Atau ganti PORT di server.js (konstanta PORT = 8000)`);
    console.error(`    - Atau jalankan: ${USE_COLOR ? '\x1b[36m' : ''}node -e "require('child_process').execSync('netstat -ano | findstr :${PORT}')"${USE_COLOR ? '\x1b[0m' : ''}`);
    process.exit(1);
  }
  console.error(`\n${USE_COLOR ? '\x1b[31m' : ''}✗ Server error: ${err.code} — ${err.message}${USE_COLOR ? '\x1b[0m' : ''}`);
  process.exit(1);
});

// Guard supaya dua signal berdekatan tidak memasang timer/server.close() ganda
let shuttingDown = false;

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${USE_COLOR ? '\x1b[33m' : ''}⚠ Menerima ${signal}, shutdown gracefully...${USE_COLOR ? '\x1b[0m' : ''}`);
  // Force exit setelah 5s jika close menggantung; timer dibersihkan saat close normal
  const forceTimer = setTimeout(() => {
    console.error(`${USE_COLOR ? '\x1b[31m' : ''}✗ Force exit setelah timeout${USE_COLOR ? '\x1b[0m' : ''}`);
    process.exit(1);
  }, 5000);
  server.close(() => {
    clearTimeout(forceTimer);
    console.log(`${USE_COLOR ? '\x1b[32m' : ''}✓ Server berhenti${USE_COLOR ? '\x1b[0m' : ''}`);
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

server.listen(PORT, HOST, () => {
  printStartupBanner();
  console.log(`Server online — http://${HOST}:${PORT} — health: http://${HOST}:${PORT}/health — PID ${process.pid}`);
});
