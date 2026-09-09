#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export async function verifyDeployment(baseUrl, { fetch: fetchImpl = fetch } = {}) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(base.hostname)) throw new Error('Remote deployment URL must use HTTPS');
  const results = [];
  const check = (name, condition, detail) => results.push({ name, ok: Boolean(condition), detail: condition ? 'ok' : detail });
  const get = (path, options = {}) => fetchImpl(new URL(path, base), { redirect: 'manual', ...options });

  try {
    const page = await get('/'); const text = await page.text();
    check('page', page.status === 200 && /app\.js/.test(text), `expected app page, got ${page.status}`);
    check('security headers', page.headers.get('x-content-type-options') === 'nosniff', 'missing X-Content-Type-Options: nosniff');
  } catch (error) { check('page', false, error.message); check('security headers', false, 'page unavailable'); }
  try { const asset = await get('/app.js'); check('static asset', asset.status === 200 && /javascript/.test(asset.headers.get('content-type') || ''), `unexpected static response ${asset.status}`); } catch (error) { check('static asset', false, error.message); }
  try {
    const response = await get('/api/config'); const body = await response.json();
    check('public config', response.status === 200 && body.googlePickerApiKey && /^\d+$/.test(body.googleProjectNumber || '') && body.googleClientId && !body.googleClientSecret && !body.geminiApiKey, `unexpected config response ${response.status}`);
  } catch (error) { check('public config', false, error.message); }
  try { const response = await get('/api/auth/google'); const location = response.headers.get('location') || ''; check('OAuth redirect', response.status === 302 && location.startsWith('https://accounts.google.com/'), `unexpected OAuth response ${response.status}`); } catch (error) { check('OAuth redirect', false, error.message); }
  try { const response = await get('/api/not-real'); check('unknown API error', response.status === 404 && /application\/json/.test(response.headers.get('content-type') || ''), `unexpected error response ${response.status}`); } catch (error) { check('unknown API error', false, error.message); }
  try { const response = await get('/api/transcribe'); check('method protection', response.status === 405, `GET mutation endpoint returned ${response.status}`); } catch (error) { check('method protection', false, error.message); }
  return results;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const base = process.argv[2];
  if (!base) { console.error('Usage: npm run verify:deployment -- https://YOUR_DOMAIN'); process.exitCode = 2; }
  else {
    try {
      const results = await verifyDeployment(base);
      for (const result of results) console.log(`${result.ok ? 'PASS' : 'FAIL'} ${result.name}${result.ok ? '' : `: ${result.detail}`}`);
      if (results.some(result => !result.ok)) process.exitCode = 1;
    } catch (error) { console.error(`Verification failed: ${error.message}`); process.exitCode = 1; }
  }
}