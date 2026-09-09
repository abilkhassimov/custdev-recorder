#!/usr/bin/env node
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import config from './api/config.js';
import google from './api/auth/google.js';
import callback from './api/auth/callback.js';
import session from './api/auth/session.js';
import logout from './api/auth/logout.js';
import accessToken from './api/google/access-token.js';
import uploadSession from './api/upload-session.js';
import verifyUpload from './api/verify-upload.js';
import saveText from './api/drive/save-text.js';
import parse from './api/questionnaire/parse.js';
import transcribe from './api/transcribe.js';
import segment from './api/segment.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const handlers = new Map(Object.entries({
  '/api/config': config, '/api/auth/google': google, '/api/auth/callback': callback,
  '/api/auth/session': session, '/api/auth/logout': logout, '/api/google/access-token': accessToken,
  '/api/upload-session': uploadSession, '/api/verify-upload': verifyUpload,
  '/api/drive/save-text': saveText, '/api/questionnaire/parse': parse,
  '/api/transcribe': transcribe, '/api/segment': segment
}));
const staticFiles = new Set(['index.html', 'app.js', 'frontend-core.js', 'style.css', 'fonts.css', 'manifest.webmanifest', 'icon.svg', 'icon-32.png', 'icon-180.png', 'fonts/manrope-400-cyrillic.woff2', 'fonts/manrope-700-cyrillic.woff2', 'fonts/unbounded-500-cyrillic.woff2']);
const mime = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.webmanifest': 'application/manifest+json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2' };

function enhanceResponse(res) {
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.end(JSON.stringify(body)); return res; };
  return res;
}
function jsonError(res, status, code) { res.statusCode = status; res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify({ error: { code, message: status === 404 ? 'Not found' : 'Request error' } })); }
async function readJson(req) {
  let size = 0; const chunks = [];
  for await (const chunk of req) { size += chunk.length; if (size > 6 * 1024 * 1024) throw Object.assign(new Error('too large'), { status: 413 }); chunks.push(chunk); }
  if (size) req.body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

export function createApp() {
  return http.createServer(async (req, rawRes) => {
    const res = enhanceResponse(rawRes);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('X-Frame-Options', 'DENY');
    let pathname;
    try { pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { return jsonError(res, 400, 'bad_request'); }
    const handler = handlers.get(pathname);
    if (handler) {
      res.setHeader('Cache-Control', 'no-store');
      try {
        if ((req.headers['content-type'] || '').startsWith('application/json')) await readJson(req);
        await handler(req, res);
      } catch { if (!res.headersSent) jsonError(res, 400, 'bad_request'); else res.destroy(); }
      return;
    }
    if (pathname.startsWith('/api/')) return jsonError(res, 404, 'not_found');
    const relative = pathname === '/' ? 'index.html' : pathname.slice(1);
    if (!staticFiles.has(relative) || relative.includes('..') || resolve(root, relative).slice(0, root.length) !== root) return jsonError(res, 404, 'not_found');
    try { res.setHeader('Content-Type', mime[extname(relative)] || 'application/octet-stream'); res.setHeader('Cache-Control', relative === 'index.html' ? 'no-cache' : 'public, max-age=3600'); res.end(await readFile(resolve(root, relative))); }
    catch { jsonError(res, 404, 'not_found'); }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT || 3000);
  createApp().listen(port, process.env.HOST || '0.0.0.0', () => console.log(`CustDev Recorder listening on port ${port}`));
}