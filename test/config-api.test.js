import test from 'node:test';
import assert from 'node:assert/strict';
import { createConfigHandler } from '../api/config.js';

function response() {
  return { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; return this; }, status(n) { this.statusCode = n; return this; }, json(value) { this.body = value; return this; }, end(value) { this.body = JSON.parse(value); } };
}

test('public config exposes picker values and no OAuth secret', async () => {
  const handler = createConfigHandler({ GOOGLE_PICKER_API_KEY: 'picker-key', GOOGLE_CLOUD_PROJECT_NUMBER: '123456', GOOGLE_CLIENT_ID: 'client.apps.googleusercontent.com', GOOGLE_CLIENT_SECRET: 'never-public' });
  const res = response();
  await handler({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, { googlePickerApiKey: 'picker-key', googleProjectNumber: '123456', googleClientId: 'client.apps.googleusercontent.com' });
  assert.doesNotMatch(JSON.stringify(res.body), /secret/i);
});

test('public config returns a controlled error when picker config is incomplete', async () => {
  const res = response();
  await createConfigHandler({ GOOGLE_CLOUD_PROJECT_NUMBER: '123456', GOOGLE_CLIENT_ID: 'id' })({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 503);
  assert.equal(res.body.code, 'config_unavailable');
  assert.doesNotMatch(JSON.stringify(res.body), /ai-secret/);
});
