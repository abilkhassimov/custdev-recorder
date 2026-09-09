import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEnvironment } from '../scripts/preflight.mjs';

const valid = {
  SESSION_SECRET: 's'.repeat(48),
  GOOGLE_CLIENT_ID: '1234567890-abc.apps.googleusercontent.com',
  GOOGLE_CLIENT_SECRET: 'GOCSPX-example-secret',
  GOOGLE_REDIRECT_URI: 'https://example.com/api/auth/callback',
  GEMINI_API_KEY: 'AIzaSyExampleGeminiKey1234567890',
  GOOGLE_PICKER_API_KEY: 'AIzaSyExamplePickerKey1234567890',
  GOOGLE_CLOUD_PROJECT_NUMBER: '123456789012'
};

test('preflight accepts seven distinct, correctly shaped production values', () => {
  assert.deepEqual(validateEnvironment(valid, { production: true }), []);
});

test('preflight reports names but never secret values', () => {
  const env = { ...valid, SESSION_SECRET: 'short-secret-value', GEMINI_API_KEY: valid.GOOGLE_PICKER_API_KEY };
  const output = validateEnvironment(env, { production: true }).join('\n');
  assert.match(output, /SESSION_SECRET/);
  assert.match(output, /must be different/);
  for (const value of Object.values(env)) assert.equal(output.includes(value), false);
});

test('preflight requires HTTPS in production and the exact callback path', () => {
  assert.match(validateEnvironment({ ...valid, GOOGLE_REDIRECT_URI: 'http://example.com/api/auth/callback' }, { production: true }).join(), /HTTPS/);
  assert.match(validateEnvironment({ ...valid, GOOGLE_REDIRECT_URI: 'https://example.com/callback' }, { production: true }).join(), /\/api\/auth\/callback/);
  assert.deepEqual(validateEnvironment({ ...valid, GOOGLE_REDIRECT_URI: 'http://localhost:3000/api/auth/callback' }, { production: false }), []);
});