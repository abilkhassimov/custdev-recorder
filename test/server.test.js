import test from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { createApp } from '../server.mjs';

async function withServer(run) {
  const server = createApp();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { server.close(); await once(server, 'close'); }
}

test('server serves the app and static assets with security headers', () => withServer(async base => {
  const page = await fetch(`${base}/`);
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.equal(page.headers.get('x-content-type-options'), 'nosniff');
  const css = await fetch(`${base}/style.css`);
  assert.equal(css.status, 200);
  assert.match(css.headers.get('content-type'), /text\/css/);
}));

test('server rejects encoded traversal and does not fall back for unknown routes', () => withServer(async base => {
  for (const path of ['/..%2fpackage.json', '/%2e%2e/package.json', '/missing']) {
    const response = await fetch(base + path);
    assert.equal(response.status, 404);
    assert.doesNotMatch(await response.text(), /"scripts"/);
  }
}));

test('server dispatches only known API routes and preserves controlled errors', () => withServer(async base => {
  const config = await fetch(`${base}/api/config`);
  assert.equal(config.status, 503);
  assert.equal((await config.json()).code, 'config_unavailable');
  const unknown = await fetch(`${base}/api/not-real`);
  assert.equal(unknown.status, 404);
  assert.equal((await unknown.json()).error.code, 'not_found');
}));