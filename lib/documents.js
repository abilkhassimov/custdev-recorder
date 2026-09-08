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
export function validateDocxArchive(buffer,{maxEntries=1000,maxUncompressed=50*1024*1024,maxRatio=100}={}) {
  const start=Math.max(0,buffer.length-65_557); let end=-1;
  for(let i=buffer.length-22;i>=start;i--)if(buffer.readUInt32LE(i)===0x06054b50){end=i;break;}
  if(end<0)throw new HttpError(400,'Unsafe or invalid DOCX archive','invalid_document');
  const entries=buffer.readUInt16LE(end+10),centralSize=buffer.readUInt32LE(end+12),centralOffset=buffer.readUInt32LE(end+16);
  if(entries>maxEntries||centralOffset+centralSize>buffer.length)throw new HttpError(400,'Unsafe DOCX archive','invalid_document');
  let offset=centralOffset,totalCompressed=0,totalUncompressed=0;
  for(let i=0;i<entries;i++){
    if(offset+46>buffer.length||buffer.readUInt32LE(offset)!==0x02014b50)throw new HttpError(400,'Invalid DOCX archive','invalid_document');
    const compressed=buffer.readUInt32LE(offset+20),uncompressed=buffer.readUInt32LE(offset+24);totalCompressed+=compressed;totalUncompressed+=uncompressed;
    if(totalUncompressed>maxUncompressed||(uncompressed>1024&&uncompressed/Math.max(1,compressed)>maxRatio))throw new HttpError(400,'Unsafe DOCX archive','invalid_document');
    offset+=46+buffer.readUInt16LE(offset+28)+buffer.readUInt16LE(offset+30)+buffer.readUInt16LE(offset+32);
  }
  if(totalUncompressed>1024&&totalUncompressed/Math.max(1,totalCompressed)>maxRatio)throw new HttpError(400,'Unsafe DOCX archive','invalid_document');
}
async function bounded(task,ms=15_000){let timer;try{return await Promise.race([task(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new HttpError(408,'Document parsing timed out','parse_timeout')),ms);})]);}finally{clearTimeout(timer);}}
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
export async function extractUpload({buffer,ext}){ let text; if(ext==='.txt'||ext==='.md')text=buffer.toString('utf8'); else if(ext==='.docx'){validateDocxArchive(buffer);text=(await bounded(()=>mammoth.extractRawText({buffer}))).value;} else {const parser=new PDFParse({data:buffer});try{text=(await bounded(()=>parser.getText())).text;}finally{await parser.destroy();}} const normalized=normalizeText(text); if(!normalized)throw new HttpError(400,'Document contains no text','empty_document'); return normalized; }
