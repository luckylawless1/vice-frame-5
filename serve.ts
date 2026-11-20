// VICE FRAME 5 — local preview server.
//
// Serves the static files under app/ so the cover maker can be tried in a
// browser without any build step:
//
//   node serve.ts            -> http://localhost:8080
//   node serve.ts --port N   -> http://localhost:N
//
// Node standard library only. This is a development convenience: it binds
// to localhost, sends no-store caching headers, and refuses to serve
// anything outside app/.

import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = resolve(fileURLToPath(new URL('./app', import.meta.url)));

function pickPort(argv: string[]): number {
  const flagAt = argv.indexOf('--port');
  const raw = flagAt >= 0 ? Number(argv[flagAt + 1]) : 8080;
  return Number.isInteger(raw) && raw > 0 && raw < 65536 ? raw : 8080;
}

const CONTENT_TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.otf': 'font/otf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
};

function contentTypeFor(filePath: string): string {
  return CONTENT_TYPES[extname(filePath).toLowerCase()] ?? 'application/octet-stream';
}

// Turn a request URL into a file path inside app/, or null when the
// request tries to escape the folder or names nothing servable.
function resolveRequestPath(requestUrl: string | undefined): string | null {
  let pathname: string;
  try {
    pathname = decodeURIComponent(new URL(requestUrl ?? '/', 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';
  const candidate = resolve(join(appRoot, normalize(pathname)));
  if (candidate !== appRoot && !candidate.startsWith(appRoot + sep)) return null;
  return candidate;
}

const server = createServer((req, res) => {
  const filePath = resolveRequestPath(req.url);
  if (filePath === null) {
    res.writeHead(400).end('bad request');
    return;
  }
  let size: number;
  try {
    const info = statSync(filePath);
    if (!info.isFile()) throw new Error('directory');
    size = info.size;
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, {
    'content-type': contentTypeFor(filePath),
    'content-length': size,
    'cache-control': 'no-store',
  });
  createReadStream(filePath).pipe(res);
});

server.listen(pickPort(process.argv.slice(2)), '127.0.0.1', () => {
  const address = server.address();
  const port = typeof address === 'object' && address !== null ? address.port : 8080;
  console.log(`VICE FRAME 5 preview: http://localhost:${port}`);
});
