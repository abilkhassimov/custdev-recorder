import test from 'node:test';
import assert from 'node:assert/strict';
import {
  validateConfig, normalizeQuestionnaire, addBlock, addQuestion, deleteBlock,
  deleteQuestion, moveBlock, moveQuestion, updateBlock, updateQuestion,
  safeFilename, buildMarkdown, migrateState, batchBlobs, canRecord
} from '../frontend-core.js';

const sample = () => ({ title: 'Исследование', blocks: [
  { id: 'b1', title: 'Контекст', questions: [{ id: 'q1', text: 'Что произошло?', hint: 'Последний случай' }] },
  { id: 'b2', title: 'Решение', questions: [{ id: 'q2', text: 'Что сделали?' }] }
] });

test('validateConfig accepts complete picker config and rejects secrets or missing values', () => {
  assert.deepEqual(validateConfig({ googlePickerApiKey: 'key', googleProjectNumber: '123', googleClientId: 'id.apps.googleusercontent.com' }), { googlePickerApiKey: 'key', googleProjectNumber: '123', googleClientId: 'id.apps.googleusercontent.com' });
  assert.throws(() => validateConfig({ googlePickerApiKey: '', googleProjectNumber: '123' }), /настрой/i);
  assert.throws(() => validateConfig({ googlePickerApiKey: 'key', googleProjectNumber: '123', googleClientSecret: 'never' }), /секрет/i);
});

test('normalizeQuestionnaire repairs imported shape and provides stable unique ids', () => {
  const q = normalizeQuestionnaire({ title: '  План  ', blocks: [{ title: ' Блок ', questions: [' Один? ', { id: 'same', text: 'Два?' }, { id: 'same', text: 'Три?' }] }] });
  assert.equal(q.title, 'План');
  assert.deepEqual(q.blocks[0].questions.map(x => x.text), ['Один?', 'Два?', 'Три?']);
  assert.equal(new Set(q.blocks[0].questions.map(x => x.id)).size, 3);
  assert.throws(() => normalizeQuestionnaire({ title: '', blocks: [] }), /вопрос/i);
});

test('questionnaire immutable edit helpers add, edit, delete and reorder blocks', () => {
  const original = sample();
  const added = addBlock(original, 'Финал');
  assert.equal(added.blocks.length, 3); assert.equal(original.blocks.length, 2);
  assert.equal(updateBlock(added, added.blocks[2].id, 'Итоги').blocks[2].title, 'Итоги');
  assert.equal(moveBlock(added, added.blocks[2].id, -1).blocks[1].title, 'Финал');
  assert.equal(deleteBlock(added, added.blocks[2].id).blocks.length, 2);
});

test('questionnaire immutable edit helpers add, edit, delete and reorder questions', () => {
  const original = sample();
  const added = addQuestion(original, 'b1', 'Почему?');
  const id = added.blocks[0].questions[1].id;
  assert.equal(updateQuestion(added, 'b1', id, { text: 'Зачем?', hint: 'Уточнить' }).blocks[0].questions[1].hint, 'Уточнить');
  assert.equal(moveQuestion(added, 'b1', id, -1).blocks[0].questions[0].text, 'Почему?');
  assert.equal(deleteQuestion(added, 'b1', id).blocks[0].questions.length, 1);
});

test('safeFilename removes path/control characters and keeps a bounded useful name', () => {
  assert.equal(safeFilename('  ООО / Рога: Иван\u0000 ', 'webm'), 'ООО — Рога — Иван.webm');
  assert.equal(safeFilename('...', 'md'), 'Интервью.md');
  assert.ok(safeFilename('я'.repeat(300), 'md').length <= 124);
});

test('buildMarkdown creates readable escaped interview document with unanswered questions', () => {
  const text = buildMarkdown({ project: 'Новый рынок', interviewee: 'Иван', startedAt: '2026-09-08T10:00:00.000Z', questionnaire: sample(), transcript: 'Полный **разговор**', segments: [{ questionId: 'q1', answer: 'Было сложно' }], audioFile: { id: 'drive-id', name: 'audio.webm' } });
  assert.match(text, /^# Интервью: Иван/m);
  assert.match(text, /Проект: Новый рынок/);
  assert.match(text, /## Контекст[\s\S]*### Что произошло\?[\s\S]*Было сложно/);
  assert.match(text, /### Что сделали\?[\s\S]*_Ответ не выделен автоматически_/);
  assert.match(text, /Полный \\\*\\\*разговор\\\*\\\*/);
  assert.match(text, /drive-id/);
});

test('migrateState accepts current/legacy settings, strips tokens, and rejects broken state', () => {
  const current = migrateState({ version: 2, folder: { id: 'abc_DEF-1234567890', name: 'Интервью' }, questionnaire: sample(), accessToken: 'secret' });
  assert.equal(current.version, 2); assert.equal(current.accessToken, undefined);
  const legacy = migrateState({ folderId: 'abc_DEF-1234567890', folderName: 'Drive', questionnaire: sample(), token: 'secret' });
  assert.deepEqual(legacy.folder, { id: 'abc_DEF-1234567890', name: 'Drive' });
  assert.equal(migrateState({ folderId: '../bad', questionnaire: sample() }), null);
  assert.equal(migrateState(null), null);
});

test('recording batches stay below the JSON-safe binary limit without losing order', async () => {
  const chunks=[new Blob([Buffer.alloc(700_000,1)]),new Blob([Buffer.alloc(700_000,2)]),new Blob([Buffer.alloc(700_000,3)]),new Blob([Buffer.alloc(700_000,4)])];
  const batches=batchBlobs(chunks,'audio/webm',2_000_000);
  assert.deepEqual(batches.map(x=>x.size),[1_400_000,1_400_000]);
  assert.equal(Buffer.concat(await Promise.all(batches.map(async x=>Buffer.from(await x.arrayBuffer())))).length,2_800_000);
  assert.throws(()=>batchBlobs([new Blob([Buffer.alloc(2_000_001)])],'audio/webm',2_000_000),/chunk/i);
});

test('recorder availability requires session, settings, and a current valid BYOK key', () => {
  const key=`AIza${'a'.repeat(35)}`;
  assert.equal(canRecord({email:'a@example.com'}, {folder:{id:'x'},questionnaire:{blocks:[{}]}},key),true);
  assert.equal(canRecord({email:'a@example.com'}, {folder:{id:'x'},questionnaire:{blocks:[{}]}},null),false);
  assert.equal(canRecord({email:'a@example.com'}, {folder:{id:'x'},questionnaire:{blocks:[{}]}},'invalid'),false);
  assert.equal(canRecord(null, {folder:{id:'x'},questionnaire:{blocks:[{}]}},key),false);
  assert.equal(canRecord({email:'a@example.com'}, null,key),false);
});

test('BYOK request headers accept only a conservative Google API key format', async () => {
  const { geminiHeaders, isGeminiApiKey } = await import('../frontend-core.js');
  const key=`AIza${'z'.repeat(35)}`;
  assert.equal(isGeminiApiKey(key),true); assert.equal(isGeminiApiKey('bad key'),false);
  assert.deepEqual(geminiHeaders(key),{'X-Gemini-API-Key':key});
  assert.throws(()=>geminiHeaders('invalid'),/Gemini/);
});

test('migrated and exported nonsecret state cannot retain a Gemini key', () => {
  const key=`AIza${'s'.repeat(35)}`;
  const state=migrateState({version:2,folder:{id:'abc_DEF-1234567890',name:'Drive'},questionnaire:sample(),geminiApiKey:key});
  assert.equal(JSON.stringify(state).includes(key),false);
  assert.equal(state.geminiApiKey,undefined);
});
