/**
 * Invoices - Google Drive bridge (VDS / TDS challan files)
 *
 * The task tracker app sends the VDS and TDS challan copies of an invoice here, and this script saves them in
 * YOUR Google Drive:
 *
 *      TDS-VDS  >  <Invoice number>  >  VDS   >  <File>
 *                                    >  TDS   >  <File>
 *
 * Every request is checked against the task tracker login first (Supabase), so only people the Admin gave the
 * Invoices tab to can upload or download, and only the Admin (or the person who uploaded a file) can delete it.
 *
 * SETUP (once)
 *  1. Go to script.google.com > New project. Name it "Invoice Files".
 *  2. Delete the starter code, paste this whole file into Code.gs, click Save.
 *  3. Deploy > New deployment > gear icon > Web app
 *       - Execute as:      Me
 *       - Who has access:  Anyone
 *     Click Deploy, then "Authorize access" and allow it (Drive and external requests).
 *  4. Copy the Web app URL (it ends in /exec).
 *  5. In the task tracker: Admin Panel > Tab Access > Invoices Access > "Drive upload link" > paste it > Save.
 *
 * If you ever change this code: Deploy > Manage deployments > pencil > Version: New version > Deploy.
 */

const SUPABASE_URL = 'https://sjqcoxosfuvsrqoglqxn.supabase.co';
const SUPABASE_KEY = 'sb_publishable_YFlLmEIMXg6uVFSXi3mYaw_e_cFxP4a';

const ROOT_NAME = 'TDS-VDS';      // the main folder in My Drive (created automatically)
const ROOT_FOLDER_ID = '';        // optional: paste the ID of an existing folder to use it instead

const UPLOAD_URL_START = 'https://www.googleapis.com/upload/drive/v3/files?';

function doGet() {
  return out_({ ok: true, message: 'Invoice Files bridge is running.' });
}

function doPost(e) {
  try {
    const req = JSON.parse(e.postData.contents);
    switch (req.action) {
      case 'start':    return out_(start_(req));
      case 'chunk':    return out_(chunk_(req));
      case 'status':   return out_(status_(req));
      case 'info':     return out_(info_(req));
      case 'read':     return out_(read_(req));
      case 'delete':   return out_(delete_(req));
      default:         throw new Error('Unknown action');
    }
  } catch (err) {
    return out_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// ---------------------------------------------------------------- login check (Supabase)
function auth_(token, needAdmin) {
  if (!token) throw new Error('Please log in again.');
  const cache = CacheService.getScriptCache();
  const key = 'auth:' + (needAdmin ? 'A:' : 'U:') + Utilities.base64EncodeWebSafe(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, token)
  );
  if (cache.get(key) === '1') return;

  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/app_invoice_file_auth', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({ p_session: token, p_need_admin: !!needAdmin }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Could not check your login. Has supabase_invoice_files.sql been run?');
  if (JSON.parse(res.getContentText()) !== true) {
    throw new Error(needAdmin ? 'Only Admin can do this.' : 'You do not have access to Invoices.');
  }
  cache.put(key, '1', 60);
}

// ---------------------------------------------------------------- folders
function rootFolder_() {
  const props = PropertiesService.getScriptProperties();
  if (ROOT_FOLDER_ID) return DriveApp.getFolderById(ROOT_FOLDER_ID);
  const saved = props.getProperty('ROOT_ID');
  if (saved) {
    try {
      const f = DriveApp.getFolderById(saved);
      if (!f.isTrashed()) return f;
    } catch (e) { /* create a new one below */ }
  }
  const folder = DriveApp.createFolder(ROOT_NAME);
  props.setProperty('ROOT_ID', folder.getId());
  return folder;
}

function safeName_(name, fallback) {
  const s = String(name || '').replace(/[\\\/:*?"<>|\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return s || fallback;
}

function childFolder_(parent, name) {
  const it = parent.getFoldersByName(name);
  while (it.hasNext()) {
    const f = it.next();
    if (!f.isTrashed()) return f;
  }
  return parent.createFolder(name);
}

function uniqueName_(folder, name) {
  if (!folder.getFilesByName(name).hasNext()) return name;
  const dot = name.lastIndexOf('.');
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  for (let i = 2; i < 1000; i++) {
    const candidate = base + ' (' + i + ')' + ext;
    if (!folder.getFilesByName(candidate).hasNext()) return candidate;
  }
  return base + ' (' + Date.now() + ')' + ext;
}

/** The file must sit in TDS-VDS / <invoice number> / VDS or TDS. Nothing else is reachable. */
function checkedFile_(fileId) {
  const file = DriveApp.getFileById(fileId);
  const root = rootFolder_().getId();
  const kinds = file.getParents();
  while (kinds.hasNext()) {
    const invoices = kinds.next().getParents();
    while (invoices.hasNext()) {
      const tops = invoices.next().getParents();
      while (tops.hasNext()) {
        if (tops.next().getId() === root) return file;
      }
    }
  }
  throw new Error('File not found.');
}

// ---------------------------------------------------------------- upload (in pieces, so big files work)
function start_(req) {
  auth_(req.token, false);
  const size = Number(req.size);
  if (!size || size < 1) throw new Error('The file is empty.');
  const invoice = childFolder_(rootFolder_(), safeName_(req.invoiceNo, 'No invoice number'));
  const client = childFolder_(invoice, req.kind === 'VDS' ? 'VDS' : 'TDS');
  const name = uniqueName_(client, safeName_(req.fileName, 'file'));
  const mime = req.mime || 'application/octet-stream';

  const res = UrlFetchApp.fetch(UPLOAD_URL_START + 'uploadType=resumable&supportsAllDrives=true', {
    method: 'post',
    contentType: 'application/json; charset=UTF-8',
    headers: {
      Authorization: 'Bearer ' + ScriptApp.getOAuthToken(),
      'X-Upload-Content-Type': mime,
      'X-Upload-Content-Length': String(size)
    },
    payload: JSON.stringify({ name: name, parents: [client.getId()] }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Google Drive refused the upload (' + res.getResponseCode() + ').');
  const headers = res.getAllHeaders();
  let sessionUrl = '';
  Object.keys(headers).forEach(function (k) { if (k.toLowerCase() === 'location') sessionUrl = String(headers[k]); });
  if (!sessionUrl) throw new Error('Google Drive did not start the upload.');
  return { ok: true, sessionUrl: sessionUrl, name: name, clientFolder: invoice.getName() + ' / ' + client.getName() };
}

function chunk_(req) {
  auth_(req.token, false);
  if (String(req.sessionUrl).indexOf(UPLOAD_URL_START) !== 0) throw new Error('Bad upload link.');
  const bytes = Utilities.base64Decode(req.data);
  const start = Number(req.start);
  const total = Number(req.total);
  const end = start + bytes.length - 1;

  const res = UrlFetchApp.fetch(req.sessionUrl, {
    method: 'put',
    contentType: req.mime || 'application/octet-stream',
    headers: { 'Content-Range': 'bytes ' + start + '-' + end + '/' + total },
    payload: bytes,
    followRedirects: false,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 308) return { ok: true, done: false, received: received_(res) };
  if (code === 200 || code === 201) {
    const file = JSON.parse(res.getContentText());
    return { ok: true, done: true, fileId: file.id, name: file.name };
  }
  throw new Error('Upload failed (' + code + ').');
}

/** How many bytes Google Drive has stored so far (from its "Range: bytes=0-N" answer). */
function received_(res) {
  const headers = res.getAllHeaders();
  let range = '';
  Object.keys(headers).forEach(function (k) { if (k.toLowerCase() === 'range') range = String(headers[k]); });
  const m = /bytes=0-(\d+)/.exec(range);
  return m ? Number(m[1]) + 1 : 0;
}

/** Asks Google Drive how far an upload got (so the app can send what is missing). */
function status_(req) {
  auth_(req.token, false);
  if (String(req.sessionUrl).indexOf(UPLOAD_URL_START) !== 0) throw new Error('Bad upload link.');
  const res = UrlFetchApp.fetch(req.sessionUrl, {
    method: 'put',
    contentType: req.mime || 'application/octet-stream',
    headers: { 'Content-Range': 'bytes */' + Number(req.total) },
    payload: '',
    followRedirects: false,
    muteHttpExceptions: true
  });
  const code = res.getResponseCode();
  if (code === 200 || code === 201) {
    const file = JSON.parse(res.getContentText());
    return { ok: true, done: true, fileId: file.id, name: file.name };
  }
  if (code === 308) return { ok: true, done: false, received: received_(res) };
  throw new Error('Could not check the upload (' + code + ').');
}

// ---------------------------------------------------------------- download (in pieces)
function info_(req) {
  auth_(req.token, false);
  const file = checkedFile_(req.fileId);
  return { ok: true, name: file.getName(), size: file.getSize(), mime: file.getMimeType() };
}

function read_(req) {
  auth_(req.token, false);
  checkedFile_(req.fileId);
  const res = UrlFetchApp.fetch(
    'https://www.googleapis.com/drive/v3/files/' + encodeURIComponent(req.fileId) + '?alt=media&supportsAllDrives=true',
    {
      headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken(), Range: 'bytes=' + Number(req.start) + '-' + Number(req.end) },
      muteHttpExceptions: true
    }
  );
  const code = res.getResponseCode();
  if (code !== 200 && code !== 206) throw new Error('Could not read the file (' + code + ').');
  return { ok: true, data: Utilities.base64Encode(res.getContent()) };
}

// ---------------------------------------------------------------- delete (Admin, or the person who uploaded the file)
function canDelete_(token, fileId) {
  if (!token) throw new Error('Please log in again.');
  const res = UrlFetchApp.fetch(SUPABASE_URL + '/rest/v1/rpc/app_invoice_file_can_delete', {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: SUPABASE_KEY },
    payload: JSON.stringify({ p_session: token, p_drive_file_id: String(fileId || '') }),
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) throw new Error('Could not check your login. Has supabase_attachment_delete_own.sql been run?');
  if (JSON.parse(res.getContentText()) !== true) throw new Error('Only Admin or the person who uploaded this file can delete it.');
}

function delete_(req) {
  canDelete_(req.token, req.fileId);
  checkedFile_(req.fileId).setTrashed(true);
  return { ok: true };
}
