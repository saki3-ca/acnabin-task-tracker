// Talks to the Google Apps Script Drive bridges (apps_script/ProposalFiles.gs and apps_script/InvoiceFiles.gs).
// Big files go in pieces, so a single request never gets too large.
import { api } from '../services/api';

export const MAX_FILE_BYTES = 100 * 1024 * 1024; // 100 MB
const UP_CHUNK = 4 * 1024 * 1024; // must be a multiple of 256 KB (Google Drive rule)
const DOWN_CHUNK = 3 * 1024 * 1024;

type Json = Record<string, any>;

async function call(url: string, body: Json): Promise<Json> {
  const token = api.getSessionToken();
  if (!token) throw new Error('Please log out and log in again.');
  let res: Response;
  try {
    // text/plain keeps this a "simple" request, which Apps Script answers without extra browser checks
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ ...body, token })
    });
  } catch {
    throw new Error('Could not reach the Drive upload link. Check your internet and the link in Admin Panel.');
  }
  let data: Json;
  try {
    data = await res.json();
  } catch {
    throw new Error('The Drive upload link did not answer properly. Has the script been deployed for "Anyone"?');
  }
  if (!data.ok) throw new Error(data.error || 'The Drive upload failed.');
  return data;
}

const toBase64 = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read the file.'));
    r.readAsDataURL(blob);
  });

export interface UploadedFile {
  driveFileId: string;
  name: string;
  clientFolder: string;
}

/** Saves the file in Drive as Attachment / <client> / <file>. onProgress gets 0..1 */
export async function uploadToDrive(
  driveUrl: string,
  client: string,
  file: File,
  onProgress?: (fraction: number) => void,
  extra: Json = {}
): Promise<UploadedFile> {
  if (file.size < 1) throw new Error(`"${file.name}" is empty.`);
  if (file.size > MAX_FILE_BYTES) throw new Error(`"${file.name}" is bigger than 100 MB.`);
  const mime = file.type || 'application/octet-stream';

  const started = await call(driveUrl, { action: 'start', client, ...extra, fileName: file.name, mime, size: file.size });
  const finished = (res: Json): UploadedFile => ({ driveFileId: res.fileId, name: res.name || started.name, clientFolder: started.clientFolder });
  let sent = 0;
  let stalls = 0;
  for (;;) {
    if (sent >= file.size) {
      // Every byte was offered but Drive has not said "done": ask Drive how far it got, and send what is missing.
      let st: Json | null = null;
      try {
        st = await call(driveUrl, { action: 'status', sessionUrl: started.sessionUrl, total: file.size, mime });
      } catch {
        st = null; // an older script without "status"
      }
      if (st?.done) return finished(st);
      const got = typeof st?.received === 'number' ? st.received : null;
      if (got !== null && got < file.size && stalls < 3) {
        stalls += 1;
        sent = got;
        continue;
      }
      throw new Error(
        `"${file.name}" did not finish uploading` +
          (got !== null ? ` (Google Drive received ${fmtSize(got)} of ${fmtSize(file.size)}).` : '.') +
          ' Please try again.'
      );
    }
    const end = Math.min(sent + UP_CHUNK, file.size);
    const data = await toBase64(file.slice(sent, end));
    const res = await call(driveUrl, { action: 'chunk', sessionUrl: started.sessionUrl, start: sent, total: file.size, mime, data });
    if (res.done) return finished(res);
    // Drive may keep less than it was sent: carry on from where it really is
    const got = typeof res.received === 'number' ? res.received : end;
    if (got < end) stalls += 1;
    if (stalls > 5) throw new Error(`"${file.name}" stopped uploading at ${fmtSize(got)} of ${fmtSize(file.size)}. Please try again.`);
    sent = got > sent ? Math.min(got, end) : end;
    onProgress?.(sent / file.size);
  }
}

/** Fetches the file from Drive piece by piece and hands it to the browser as a download. */
export async function downloadFromDrive(driveUrl: string, driveFileId: string, fallbackName: string, onProgress?: (fraction: number) => void) {
  const info = await call(driveUrl, { action: 'info', fileId: driveFileId });
  const size = Number(info.size) || 0;
  const parts: Uint8Array[] = [];
  let got = 0;
  while (got < size) {
    const end = Math.min(got + DOWN_CHUNK, size) - 1;
    const res = await call(driveUrl, { action: 'read', fileId: driveFileId, start: got, end });
    const bin = atob(res.data);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    parts.push(bytes);
    got += bytes.length;
    onProgress?.(size ? got / size : 1);
    if (bytes.length === 0) break;
  }
  const blob = new Blob(parts as BlobPart[], { type: info.mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = info.name || fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Admin only: moves the file to the Drive bin. */
export async function deleteFromDrive(driveUrl: string, driveFileId: string) {
  await call(driveUrl, { action: 'delete', fileId: driveFileId });
}

export const fmtSize = (n: number) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${Math.round(n / 1024)} KB` : `${n} B`;
