const clean = value => String(value ?? '').replace(/[\u0000-\u001f\u007f]/g, '').trim();
let sequence = 0;
const id = prefix => `${prefix}_${Date.now().toString(36)}_${(++sequence).toString(36)}`;
const clone = value => JSON.parse(JSON.stringify(value));

export function isGeminiApiKey(value) { return typeof value==='string' && /^AIza[A-Za-z0-9_-]{32,96}$/.test(value); }
export function geminiHeaders(value) { if(!isGeminiApiKey(value))throw new Error('Укажите действительный ключ Google Gemini API'); return {'X-Gemini-API-Key':value}; }
export function canRecord(session, settings, geminiApiKey) { return Boolean(session?.email && settings?.folder?.id && settings?.questionnaire?.blocks?.length && isGeminiApiKey(geminiApiKey)); }
export function batchBlobs(chunks, mimeType, maxBytes = 2_500_000) {
  const batches=[]; let current=[],size=0;
  for(const chunk of chunks){if(!(chunk instanceof Blob)||chunk.size>maxBytes)throw new Error('Recording chunk exceeds safe upload limit');if(size+chunk.size>maxBytes&&current.length){batches.push(new Blob(current,{type:mimeType}));current=[];size=0;}current.push(chunk);size+=chunk.size;}
  if(current.length)batches.push(new Blob(current,{type:mimeType})); return batches;
}

export function validateConfig(value) {
  if (!value || typeof value !== 'object') throw new Error('Настройки Google Picker недоступны');
  if (Object.keys(value).some(key => /secret|token|password/i.test(key))) throw new Error('Публичные настройки не должны содержать секреты');
  const result = {
    googlePickerApiKey: clean(value.googlePickerApiKey),
    googleProjectNumber: clean(value.googleProjectNumber),
    googleClientId: clean(value.googleClientId)
  };
  if (!result.googlePickerApiKey || !/^\d+$/.test(result.googleProjectNumber) || !result.googleClientId) throw new Error('Настройки Google Picker заполнены не полностью');
  return result;
}

export function normalizeQuestionnaire(value) {
  if (!value || typeof value !== 'object') throw new Error('Добавьте опросник и хотя бы один вопрос');
  const used = new Set();
  const unique = (candidate, prefix) => {
    let result = clean(candidate) || id(prefix);
    while (used.has(result)) result = id(prefix);
    used.add(result); return result;
  };
  const blocks = (Array.isArray(value.blocks) ? value.blocks : []).map(block => {
    const questions = (Array.isArray(block?.questions) ? block.questions : []).map(question => {
      const source = typeof question === 'string' ? { text: question } : question || {};
      const text = clean(source.text);
      if (!text) return null;
      return { id: unique(source.id, 'q'), text, ...(clean(source.hint) ? { hint: clean(source.hint) } : {}) };
    }).filter(Boolean);
    if (!questions.length) return null;
    return { id: unique(block?.id, 'b'), title: clean(block?.title) || 'Без названия', questions };
  }).filter(Boolean);
  if (!blocks.length) throw new Error('Добавьте опросник и хотя бы один вопрос');
  return { title: clean(value.title) || 'Опросник интервью', blocks };
}

function mapBlock(questionnaire, blockId, fn) {
  const next = clone(questionnaire);
  next.blocks = next.blocks.map(block => block.id === blockId ? fn(block) : block);
  return next;
}
export function addBlock(q, title = 'Новый блок') { const next = clone(q); next.blocks.push({ id: id('b'), title: clean(title) || 'Новый блок', questions: [] }); return next; }
export function deleteBlock(q, blockId) { const next = clone(q); next.blocks = next.blocks.filter(x => x.id !== blockId); return next; }
export function updateBlock(q, blockId, title) { return mapBlock(q, blockId, b => ({ ...b, title: clean(title) })); }
export function moveBlock(q, blockId, delta) { const next = clone(q), from = next.blocks.findIndex(x => x.id === blockId); if (from < 0) return next; const to = Math.max(0, Math.min(next.blocks.length - 1, from + delta)); const [item] = next.blocks.splice(from, 1); next.blocks.splice(to, 0, item); return next; }
export function addQuestion(q, blockId, text = 'Новый вопрос') { return mapBlock(q, blockId, b => ({ ...b, questions: [...b.questions, { id: id('q'), text: clean(text) || 'Новый вопрос' }] })); }
export function deleteQuestion(q, blockId, questionId) { return mapBlock(q, blockId, b => ({ ...b, questions: b.questions.filter(x => x.id !== questionId) })); }
export function updateQuestion(q, blockId, questionId, values) { return mapBlock(q, blockId, b => ({ ...b, questions: b.questions.map(x => x.id === questionId ? { ...x, text: clean(values.text), ...(clean(values.hint) ? { hint: clean(values.hint) } : { hint: undefined }) } : x) })); }
export function moveQuestion(q, blockId, questionId, delta) { return mapBlock(q, blockId, b => { const questions = [...b.questions], from = questions.findIndex(x => x.id === questionId); if (from < 0) return b; const to = Math.max(0, Math.min(questions.length - 1, from + delta)); const [item] = questions.splice(from, 1); questions.splice(to, 0, item); return { ...b, questions }; }); }

export function safeFilename(name, extension) {
  const ext = clean(extension).replace(/^\.+/, '').replace(/[^a-z0-9]/gi, '') || 'dat';
  let base = clean(name).replace(/[\\/:*?"<>|]+/g, ' — ').replace(/\s+/g, ' ').replace(/(?:\s*—\s*)+/g, ' — ').replace(/^[.\s—]+|[.\s—]+$/g, '');
  if (!base) base = 'Интервью';
  base = Array.from(base).slice(0, Math.max(1, 123 - ext.length)).join('').trim();
  return `${base}.${ext.toLowerCase()}`;
}
const md = value => clean(value).replace(/([\\`*_{}\[\]()<>#+.!|~-])/g, '\\$1');
export function buildMarkdown({ project, interviewee, startedAt, questionnaire, transcript, segments = [], audioFile }) {
  const answers = new Map(segments.map(x => [x.questionId, clean(x.answer)]));
  const lines = [`# Интервью: ${md(interviewee)}`, '', `- Проект: ${md(project)}`, `- Дата: ${md(startedAt)}`];
  if (audioFile) lines.push(`- Аудио: [${md(audioFile.name || 'запись')}](https://drive.google.com/open?id=${encodeURIComponent(audioFile.id)})`);
  lines.push('', `## ${md(questionnaire.title)}`, '');
  for (const block of questionnaire.blocks) {
    lines.push(`## ${md(block.title)}`, '');
    for (const question of block.questions) lines.push(`### ${md(question.text)}`, '', answers.get(question.id) ? md(answers.get(question.id)) : '_Ответ не выделен автоматически_', '');
  }
  lines.push('## Полная расшифровка', '', md(transcript));
  return lines.join('\n').trim() + '\n';
}

export function migrateState(value) {
  try {
    if (!value || typeof value !== 'object') return null;
    const folder = value.folder || { id: value.folderId, name: value.folderName };
    if (!folder || !/^[A-Za-z0-9_-]{10,200}$/.test(folder.id || '')) return null;
    return { version: 2, folder: { id: folder.id, name: clean(folder.name) || 'Google Drive' }, questionnaire: normalizeQuestionnaire(value.questionnaire) };
  } catch { return null; }
}
