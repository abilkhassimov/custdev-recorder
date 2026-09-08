import test from 'node:test';
import assert from 'node:assert/strict';
import { sealSession, openSession, createOAuthState, verifyOAuthState, pkceChallenge } from '../lib/security.js';
import { serializeCookie } from '../lib/cookies.js';
import { assertSameOrigin } from '../lib/http.js';
import { validateFolderId, validateFilename } from '../lib/validation.js';

const secret = 'x'.repeat(32);

test('session crypto roundtrips without exposing plaintext', () => {
  const value = sealSession({ refreshToken: 'refresh-secret', email: 'a@example.com' }, secret, { now: 1000, ttl: 60 });
  assert.doesNotMatch(value, /refresh-secret/);
  assert.deepEqual(openSession(value, secret, { now: 1050 }), { refreshToken: 'refresh-secret', email: 'a@example.com' });
});

test('session crypto rejects tampering and expiry', () => {
  const value = sealSession({ refreshToken: 'r', email: 'a@b.co' }, secret, { now: 1000, ttl: 10 });
  const parts = value.split('.');
  const ciphertext = Buffer.from(parts[1], 'base64url');
  ciphertext[0] ^= 1;
  const tampered = [parts[0], ciphertext.toString('base64url'), parts[2]].join('.');
  assert.throws(() => openSession(tampered, secret, { now: 1001 }), /Invalid session/);
  assert.throws(() => openSession(value, secret, { now: 1011 }), /expired/i);
});

test('OAuth state is signed, short lived, and binds PKCE verifier', () => {
  const state = createOAuthState(secret, { now: 2000, ttl: 300 });
  assert.equal(verifyOAuthState(state.cookie, state.state, secret, { now: 2200 }).verifier, state.verifier);
  assert.equal(pkceChallenge(state.verifier).length, 43);
  assert.throws(() => verifyOAuthState(state.cookie, 'wrong', secret, { now: 2200 }), /state/i);
  assert.throws(() => verifyOAuthState(state.cookie, state.state, secret, { now: 2301 }), /expired/i);
});

test('auth cookies have required production flags', () => {
  const cookie = serializeCookie('session', 'v', { httpOnly: true, sameSite: 'Lax', secure: true, maxAge: 60, path: '/' });
  assert.match(cookie, /HttpOnly/); assert.match(cookie, /SameSite=Lax/); assert.match(cookie, /Secure/); assert.match(cookie, /Path=\//);
});

test('same-origin rejects absent and foreign origins', () => {
  assert.throws(() => assertSameOrigin({ headers: { host: 'app.test' } }), /origin/i);
  assert.throws(() => assertSameOrigin({ headers: { host: 'app.test', origin: 'https://evil.test' } }), /origin/i);
  assert.doesNotThrow(() => assertSameOrigin({ headers: { host: 'app.test', origin: 'https://app.test', 'x-forwarded-proto': 'https' } }));
});

test('folder and filename validation allow Drive IDs and safe markdown names', () => {
  assert.equal(validateFolderId('abc_DEF-1234567890'), 'abc_DEF-1234567890');
  for (const bad of ['', '../x', 'bad id!', 'short']) assert.throws(() => validateFolderId(bad));
  assert.equal(validateFilename('Interview — Acme.md'), 'Interview — Acme.md');
  assert.equal(validateFilename('Interview.webm'), 'Interview.webm');
  for (const bad of ['', '../secret.md', 'a/b.md', '.hidden.md', 'no-extension']) assert.throws(() => validateFilename(bad));
});
