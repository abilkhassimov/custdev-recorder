import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyDeployment } from '../scripts/verify-deployment.mjs';

test('deployment verifier checks public behavior without sending credentials', async () => {
  const calls = [];
  const fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    const path = new URL(url).pathname;
    const headers = new Headers({ 'x-content-type-options': 'nosniff', 'content-type': path === '/' ? 'text/html' : 'application/json' });
    if (path === '/') return new Response('<!doctype html><script src="app.js"></script>', { status: 200, headers });
    if (path === '/app.js') return new Response('const app = true', { status: 200, headers: { ...Object.fromEntries(headers), 'content-type': 'text/javascript' } });
    if (path === '/api/config') return new Response(JSON.stringify({ googlePickerApiKey: 'public', googleProjectNumber: '123', googleClientId: 'id' }), { status: 200, headers });
    if (path === '/api/auth/google') return new Response('', { status: 302, headers: { ...Object.fromEntries(headers), location: 'https://accounts.google.com/o/oauth2/v2/auth?client_id=id' } });
    if (path === '/api/not-real') return new Response('{"error":{"code":"not_found"}}', { status: 404, headers });
    if (path === '/api/transcribe') return new Response('{"error":{"code":"method_not_allowed"}}', { status: 405, headers });
    throw new Error(`unexpected ${path}`);
  };
  const results = await verifyDeployment('https://example.com', { fetch });
  assert.equal(results.every(result => result.ok), true, JSON.stringify(results));
  assert.equal(calls.every(call => !call.options.headers?.authorization && !call.options.body), true);
});

test('deployment verifier rejects non-HTTPS remote targets', async () => {
  await assert.rejects(() => verifyDeployment('http://example.com'), /HTTPS/);
});