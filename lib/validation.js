import { HttpError } from './http.js';
export function validateFolderId(value) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{10,200}$/.test(value)) throw new HttpError(400, 'Invalid folder ID', 'invalid_folder');
  return value;
}
export function validateFilename(value) {
  if (typeof value !== 'string' || value.length > 180 || !/^[^.][^/\\\0\r\n]*\.[A-Za-z0-9]{1,10}$/u.test(value) || value.includes('..')) throw new HttpError(400, 'Invalid filename', 'invalid_filename');
  return value;
}
export function validateMarkdownFilename(value) {
  const filename = validateFilename(value);
  if (!filename.toLowerCase().endsWith('.md')) throw new HttpError(400, 'Transcript filename must end in .md', 'invalid_filename');
  return filename;
}
