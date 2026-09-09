import { HttpError } from './http.js';

export const MAX_BYTES = 4 * 1024 * 1024;
export const LIMITS = Object.freeze({ title:120, blocks:20, blockTitle:120, questions:50, id:80, text:500, hint:300, transcript:500_000 });
const clean = (value, max) => String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').replace(/\r\n?/g,'\n').replace(/[ \t]+/g,' ').trim().slice(0,max);
export function normalizeText(value) { return clean(value, 200_000).replace(/\n{3,}/g,'\n\n'); }
export function safeId(value, fallback) { const id=clean(value,LIMITS.id).toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,LIMITS.id); return id || fallback; }
export function repairQuestionnaire(value) {
  if (!value || !Array.isArray(value.blocks)) throw new Error('Invalid questionnaire schema');
  const blocks=value.blocks.slice(0,LIMITS.blocks).map((block,bi)=>({
    title:clean(block?.title,LIMITS.blockTitle)||`Block ${bi+1}`,
    questions:(Array.isArray(block?.questions)?block.questions:[]).slice(0,LIMITS.questions).map((q,qi)=>{
      const text=clean(q?.text,LIMITS.text); if(!text) return null;
      const item={id:safeId(q?.id,`b${bi+1}-q${qi+1}`),text}; const hint=clean(q?.hint,LIMITS.hint); if(hint)item.hint=hint; return item;
    }).filter(Boolean)
  })).filter(block=>block.questions.length);
  if (!blocks.length) throw new Error('Invalid questionnaire schema');
  const seen=new Set(); for(const block of blocks) for(const q of block.questions){ let id=q.id,n=2; while(seen.has(id)) id=`${q.id.slice(0,74)}-${n++}`; q.id=id; seen.add(id); }
  return {title:clean(value.title,LIMITS.title)||'Questionnaire',blocks};
}
export function parseModelJson(text) { const raw=String(text??'').trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,''); return JSON.parse(raw); }
export function fallbackQuestionnaire(text) {
  const lines=normalizeText(text).split('\n').map(x=>x.replace(/^\s*(?:[-*•]|\d+[.)])\s*/,'').trim()).filter(Boolean);
  const firstQuestion=lines.findIndex(x=>/[?？]$/.test(x));
  const title=clean(firstQuestion>0?lines[0]:'Questionnaire',LIMITS.title)||'Questionnaire'; let current={title:'Questions',questions:[]}; const blocks=[];
  for(const line of lines.slice(firstQuestion>0?1:0)) {
    if (!/[?？]$/.test(line) && current.questions.length) { blocks.push(current); current={title:clean(line,LIMITS.blockTitle),questions:[]}; continue; }
    if (/[?？]$/.test(line)) current.questions.push({id:`q-${blocks.reduce((n,b)=>n+b.questions.length,0)+current.questions.length+1}`,text:clean(line,LIMITS.text)});
  }
  if(current.questions.length)blocks.push(current); if(!blocks.length) blocks.push({title:'Questions',questions:[{id:'q-1',text:clean(lines[0]||'Add your question here',LIMITS.text)}]});
  return repairQuestionnaire({title,blocks});
}
export function validateQuestionnaireInput(value){ return repairQuestionnaire(value); }
export function requireGeminiApiKey(req) {
  const value=req?.headers?.['x-gemini-api-key'];
  if(typeof value!=='string'||!/^AIza[A-Za-z0-9_-]{32,96}$/.test(value)) throw new HttpError(400,'A valid Gemini API key is required','invalid_gemini_api_key');
  return value;
}
export function validateBase64(value) { if(typeof value!=='string'||!value||value.length>Math.ceil(MAX_BYTES/3)*4+4||!/^[A-Za-z0-9+/]*={0,2}$/.test(value)) throw new HttpError(400,'Invalid base64 audio','invalid_audio'); const buffer=Buffer.from(value,'base64'); if(buffer.length>MAX_BYTES)throw new HttpError(413,'Audio exceeds 4MB limit','payload_too_large'); if(!buffer.length)throw new HttpError(400,'Invalid base64 audio','invalid_audio'); return buffer; }
export async function callGemini({fetchImpl,apiKey,prompt,inlineData,responseSchema}) {
  if(!apiKey) throw new Error('Gemini unavailable');
  const parts=[{text:prompt}]; if(inlineData)parts.push({inlineData});
  const body={contents:[{role:'user',parts}],generationConfig:{temperature:0,responseMimeType:'application/json',responseSchema}};
  const result=await fetchImpl('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent',{method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':apiKey},body:JSON.stringify(body)});
  if(!result.ok)throw new Error('Gemini request failed'); const json=await result.json(); const text=json?.candidates?.[0]?.content?.parts?.map(p=>p.text||'').join(''); if(!text)throw new Error('Gemini response missing'); return text;
}
export const questionnaireSchema = {
  type: 'OBJECT', required: ['title', 'blocks'], properties: {
    title: { type: 'STRING' },
    blocks: { type: 'ARRAY', items: {
      type: 'OBJECT', required: ['title', 'questions'], properties: {
        title: { type: 'STRING' },
        questions: { type: 'ARRAY', items: {
          type: 'OBJECT', required: ['id', 'text'], properties: {
            id: { type: 'STRING' }, text: { type: 'STRING' }, hint: { type: 'STRING' }
          }
        } }
      }
    } }
  }
};
export const segmentSchema = {
  type: 'OBJECT', required: ['segments'], properties: {
    segments: { type: 'ARRAY', items: {
      type: 'OBJECT', required: ['questionId', 'answer'], properties: {
        questionId: { type: 'STRING' }, answer: { type: 'STRING' }
      }
    } }
  }
};
