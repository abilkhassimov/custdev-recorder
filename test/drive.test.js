import test from 'node:test';
import assert from 'node:assert/strict';
import { createUploadSessionHandler } from '../api/upload-session.js';
import { createVerifyUploadHandler } from '../api/verify-upload.js';
import { createSaveTextHandler } from '../api/drive/save-text.js';
import { createSessionHandler } from '../api/auth/session.js';

const secret = 's'.repeat(32);
const env = { SESSION_SECRET: secret, GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'client-secret', GOOGLE_REDIRECT_URI: 'https://app.test/api/auth/callback' };
function response() { return { headers: {}, statusCode: 200, setHeader(k,v){this.headers[k]=v; return this;}, status(n){this.statusCode=n; return this;}, json(v){this.body=v; return this;}, end(){return this;} }; }
const base = { method: 'POST', headers: { host: 'app.test', origin: 'https://app.test', 'x-forwarded-proto': 'https' }, body: {} };

test('authenticated API rejects missing session', async () => {
  const res = response(); await createSessionHandler(env)({ method: 'GET', headers: {} }, res);
  assert.equal(res.statusCode, 401); assert.equal(res.body.error.code, 'unauthenticated');
});

test('upload session refreshes token and constructs Drive resumable request', async () => {
  const calls = [];
  const fetch = async (url, init) => { calls.push([url, init]); if (String(url).includes('oauth2')) return new Response(JSON.stringify({ access_token:'access', expires_in:3600 }), { status:200 }); return new Response('', { status:200, headers:{ location:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session' } }); };
  const { sealSession } = await import('../lib/security.js');
  const req = { ...base, headers: { ...base.headers, cookie: `session=${encodeURIComponent(sealSession({refreshToken:'refresh',email:'a@example.com'},secret))}` }, body:{ folderId:'abc_DEF-1234567890', filename:'Call.md', mimeType:'audio/webm', size:123 } };
  const res=response(); await createUploadSessionHandler({ fetch, env })(req,res);
  assert.equal(res.statusCode,200); assert.deepEqual(res.body,{ uploadUrl:'https://www.googleapis.com/upload/drive/v3/files?upload_id=session' });
  assert.match(calls[0][1].body,/refresh_token=refresh/);
  assert.equal(calls[1][0],'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id%2Cname%2CmimeType%2Csize%2Cparents');
  assert.equal(calls[1][1].headers.Authorization,'Bearer access');
  assert.deepEqual(JSON.parse(calls[1][1].body),{ name:'Call.md', parents:['abc_DEF-1234567890'], mimeType:'audio/webm' });
  assert.doesNotMatch(JSON.stringify(res.body),/refresh/);
});

test('upload session rejects unsafe resumable locations', async () => {
  const { sealSession } = await import('../lib/security.js');
  const cookie=`session=${encodeURIComponent(sealSession({refreshToken:'r',email:'e@x.co'},secret))}`;
  for (const location of ['http://www.googleapis.com/upload/id','https://evil.example/upload/id','https://googleapis.com.evil.example/id']) {
    const fetch=async url=>String(url).includes('oauth2')?new Response(JSON.stringify({access_token:'a'}),{status:200}):new Response('',{status:200,headers:{location}});
    const req={...base,headers:{...base.headers,cookie},body:{folderId:'abc_DEF-1234567890',filename:'Call.webm',mimeType:'audio/webm',size:123}};
    const res=response(); await createUploadSessionHandler({fetch,env})(req,res);
    assert.equal(res.statusCode,502,location); assert.equal(res.body.error.code,'drive_error');
  }
});

test('verify upload requests constrained metadata and verifies parent', async () => {
  const calls=[]; const fetch=async(url,init)=>{calls.push([url,init]); if(String(url).includes('oauth2')) return new Response(JSON.stringify({access_token:'a'}),{status:200}); return new Response(JSON.stringify({id:'file_1234567890',name:'Call.md',mimeType:'audio/webm',size:'123',parents:['abc_DEF-1234567890']}),{status:200});};
  const { sealSession }=await import('../lib/security.js'); const req={...base,headers:{...base.headers,cookie:`session=${encodeURIComponent(sealSession({refreshToken:'r',email:'e@x.co'},secret))}`},body:{fileId:'file_1234567890',folderId:'abc_DEF-1234567890',filename:'Call.webm',mimeType:'audio/webm',size:123}};
  const res=response(); await createVerifyUploadHandler({fetch,env})(req,res);
  assert.equal(res.statusCode,200); assert.equal(res.body.verified,true); assert.match(calls[1][0],/fields=id%2Cname%2CmimeType%2Csize%2Cparents/);
});

test('save text uses multipart Drive upload with markdown metadata', async () => {
  const calls=[]; const fetch=async(url,init)=>{calls.push([url,init]); if(String(url).includes('oauth2')) return new Response(JSON.stringify({access_token:'a'}),{status:200}); return new Response(JSON.stringify({id:'text_1234567890',name:'Transcript.md',parents:['abc_DEF-1234567890']}),{status:200});};
  const { sealSession }=await import('../lib/security.js'); const req={...base,headers:{...base.headers,cookie:`session=${encodeURIComponent(sealSession({refreshToken:'r',email:'e@x.co'},secret))}`},body:{folderId:'abc_DEF-1234567890',filename:'Transcript.md',text:'# Hello'}};
  const res=response(); await createSaveTextHandler({fetch,env})(req,res);
  assert.equal(res.statusCode,200); assert.equal(res.body.file.id,'text_1234567890'); assert.match(calls[1][0],/uploadType=multipart/); assert.match(calls[1][1].body,/text\/markdown/); assert.match(calls[1][1].body,/# Hello/);
});
