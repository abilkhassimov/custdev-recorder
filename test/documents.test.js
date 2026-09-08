import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDocxArchive } from '../lib/documents.js';

function fakeZip(entries) {
  const records=entries.map(({compressed,uncompressed,name='word/document.xml'})=>{
    const filename=Buffer.from(name); const r=Buffer.alloc(46+filename.length);
    r.writeUInt32LE(0x02014b50,0); r.writeUInt32LE(compressed,20); r.writeUInt32LE(uncompressed,24); r.writeUInt16LE(filename.length,28); filename.copy(r,46); return r;
  });
  const central=Buffer.concat(records), end=Buffer.alloc(22); end.writeUInt32LE(0x06054b50,0); end.writeUInt16LE(entries.length,8); end.writeUInt16LE(entries.length,10); end.writeUInt32LE(central.length,12); end.writeUInt32LE(0,16);
  return Buffer.concat([central,end]);
}

test('DOCX metadata guard accepts practical archives', () => {
  assert.doesNotThrow(()=>validateDocxArchive(fakeZip([{compressed:1000,uncompressed:5000}])));
});

test('DOCX metadata guard rejects excessive entries, expansion and compression ratio', () => {
  assert.throws(()=>validateDocxArchive(fakeZip(Array.from({length:1001},()=>({compressed:10,uncompressed:10})))),/archive/i);
  assert.throws(()=>validateDocxArchive(fakeZip([{compressed:2_000_000,uncompressed:60_000_000}]),{maxUncompressed:50_000_000}),/archive/i);
  assert.throws(()=>validateDocxArchive(fakeZip([{compressed:100,uncompressed:2_000_000}]),{maxRatio:100}),/archive/i);
  assert.throws(()=>validateDocxArchive(Buffer.from('not a zip')),/archive/i);
});
