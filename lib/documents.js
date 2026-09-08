import Busboy from 'busboy';
import mammoth from 'mammoth';
import { PDFParse } from 'pdf-parse';
import { HttpError } from './http.js';
import { MAX_BYTES, normalizeText } from './ai.js';

const allowed=new Map([
  ['.txt',new Set(['text/plain'])],['.md',new Set(['text/markdown','text/plain'])],
  ['.pdf',new Set(['application/pdf'])],
  ['.docx',new Set(['application/vnd.openxmlformats-officedocument.wordprocessingml.document'])]
]);
export function sanitizeUploadName(value){ const name=String(value||'').normalize('NFKC').replace(/[\u0000-\u001f\u007f]/g,'').replace(/[^\p{L}\p{N}._ -]/gu,'_').replace(/\.{2,}/g,'.').slice(0,180); if(!name||name.startsWith('.')||name.includes('/')||name.includes('\\'))throw new HttpError(400,'Invalid filename','invalid_filename'); return name; }
export function validateUpload(filename,mime){ const name=sanitizeUploadName(filename); const dot=name.lastIndexOf('.'); const ext=dot<0?'':name.slice(dot).toLowerCase(); if(!allowed.get(ext)?.has(String(mime).toLowerCase()))throw new HttpError(415,'Unsupported file type','unsupported_file'); return {name,ext}; }
export async function readMultipart(req){
  const length=Number(req.headers['content-length']); if(Number.isFinite(length)&&length>MAX_BYTES)throw new HttpError(413,'File exceeds 4MB limit','payload_too_large');
  return new Promise((resolve,reject)=>{ let settled=false,found=false,meta,chunks=[],size=0;
    const fail=e=>{if(!settled){settled=true;reject(e);}}; let bb;
    try{bb=Busboy({headers:req.headers,limits:{files:1,fileSize:MAX_BYTES,fields:0,parts:1}});}catch{fail(new HttpError(400,'Invalid multipart request','invalid_request'));return;}
    bb.on('file',(_field,file,info)=>{found=true; try{meta=validateUpload(info.filename,info.mimeType);}catch(e){file.resume();fail(e);return;} file.on('data',chunk=>{size+=chunk.length;if(size<=MAX_BYTES)chunks.push(chunk);}); file.on('limit',()=>fail(new HttpError(413,'File exceeds 4MB limit','payload_too_large')));});
    bb.on('error',()=>fail(new HttpError(400,'Invalid multipart request','invalid_request'))); bb.on('finish',()=>{if(settled)return;if(!found)return fail(new HttpError(400,'File required','invalid_request'));settled=true;resolve({...meta,buffer:Buffer.concat(chunks)});}); req.pipe(bb);
  });
}
export async function extractUpload({buffer,ext}){ let text; if(ext==='.txt'||ext==='.md')text=buffer.toString('utf8'); else if(ext==='.docx')text=(await mammoth.extractRawText({buffer})).value; else {const parser=new PDFParse({data:buffer});try{text=(await parser.getText()).text;}finally{await parser.destroy();}} const normalized=normalizeText(text); if(!normalized)throw new HttpError(400,'Document contains no text','empty_document'); return normalized; }
