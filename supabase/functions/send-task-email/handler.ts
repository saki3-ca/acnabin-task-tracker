// Pure logic of the send-task-email Edge Function (no Deno / npm imports, so it can be tested).
//
// POST { session, event, ids }
//   event = TASK_ASSIGNED      ids = task ids       -> email to each assignee
//   event = TASK_REQUEST       ids = request ids    -> email to the person asked
//   event = REQUEST_RESPONDED  ids = request ids    -> email to the person who sent the request
//
// Recipients always come from the database, never from the caller. The caller must own the
// task/request, it must be recent, and each (event, item, recipient) is emailed only once.

export const MAX_IDS = 80;
export const MAX_AGE_MINUTES = 15;
export const SEND_GAP_MS = 400;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export interface CallerUser { id: string; name: string; role: string }
export interface MailUser { id: string; name: string; email: string; status: string }
export interface TaskRow {
  id: string; particular: string; client_name: string; priority: string; deadline: string;
  assigned_date: string; created_by_id: string; created_by_name: string; assigned_to_id: string; created_date: string;
}
export interface RequestRow {
  id: string | number; requester_id: string; requester_name: string; superior_id: string; superior_name: string;
  particular: string; client_name: string; priority: string; deadline: string; notes: string;
  status: string; created_at: string; updated_at?: string | null;
  /** Remarks written by whoever accepted / declined (column may not exist yet) */
  response_remarks?: string | null;
}
export interface Mail { to: string; subject: string; text: string; html: string }

export interface Deps {
  appUrl: string;
  userFromSessionHash(hash: string): Promise<CallerUser | null>;
  getTasks(ids: string[]): Promise<TaskRow[]>;
  getRequests(ids: string[]): Promise<RequestRow[]>;
  getUsers(ids: string[]): Promise<MailUser[]>;
  /** true if this (event, item, recipient) had not been emailed before and is now claimed */
  claim(event: string, refId: string, userId: string): Promise<boolean>;
  sendMail(mail: Mail): Promise<void>;
  sleep?(ms: number): Promise<void>;
  now?: () => Date;
}

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } });
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

export function escapeHtml(value: string): string {
  return String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

const clip = (v: string, n: number) => (v.length > n ? v.slice(0, n - 1) + '…' : v);
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e || '');

function layout(appUrl: string, greetingName: string, lead: string, rows: [string, string][], footer = '') {
  const text =
    `Hi ${greetingName},\n\n${lead}\n\n` +
    rows.filter(r => r[1]).map(([k, v]) => `${k}: ${v}`).join('\n') +
    `\n\nOpen the app: ${appUrl}\n${footer ? `\n${footer}\n` : ''}`;
  const html =
    `<p>Hi ${escapeHtml(greetingName)},</p><p>${escapeHtml(lead)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px">` +
    rows.filter(r => r[1]).map(([k, v]) =>
      `<tr><td style="padding:3px 14px 3px 0;color:#666;vertical-align:top">${escapeHtml(k)}</td><td style="padding:3px 0"><strong>${escapeHtml(v)}</strong></td></tr>`
    ).join('') +
    `</table>` +
    `<p style="margin:18px 0"><a href="${escapeHtml(appUrl)}" style="background:#800000;color:#fff;padding:9px 16px;border-radius:6px;text-decoration:none;font-weight:600">Open ACNABIN Task Tracker</a></p>` +
    (footer ? `<p style="color:#666;font-size:13px">${escapeHtml(footer)}</p>` : '');
  return { text, html };
}

export function assignedMail(appUrl: string, t: TaskRow, to: MailUser): Mail {
  const m = layout(appUrl, to.name || 'there', `${t.created_by_name || 'Someone'} assigned you a new task.`, [
    ['Task', t.particular], ['Client', t.client_name], ['Priority', t.priority], ['Deadline', t.deadline], ['Assigned on', t.assigned_date]
  ]);
  return { to: to.email, subject: `New task assigned: ${clip(t.particular, 80)}`, ...m };
}

export function requestMail(appUrl: string, r: RequestRow, to: MailUser): Mail {
  const m = layout(appUrl, to.name || 'there', `${r.requester_name || 'Someone'} sent you a task request. Please accept or decline it in the app.`, [
    ['Task', r.particular], ['Client', r.client_name], ['Priority', r.priority], ['Deadline', r.deadline], ['Notes', r.notes]
  ]);
  return { to: to.email, subject: `Task request from ${r.requester_name || 'a colleague'}: ${clip(r.particular, 70)}`, ...m };
}

export function responseMail(appUrl: string, r: RequestRow, to: MailUser): Mail {
  const accepted = r.status === 'ACCEPTED';
  const m = layout(
    appUrl,
    to.name || 'there',
    `${r.superior_name || 'Your colleague'} ${accepted ? 'accepted' : 'declined'} your task request.`,
    [['Task', r.particular], ['Client', r.client_name], ['Result', accepted ? 'Accepted' : 'Declined'], ['Remarks', r.response_remarks || '']]
  );
  return { to: to.email, subject: `Your task request was ${accepted ? 'accepted' : 'declined'}: ${clip(r.particular, 70)}`, ...m };
}

export function createHandler(deps: Deps) {
  const now = deps.now ?? (() => new Date());
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>(r => setTimeout(r, ms)));
  const isRecent = (iso?: string | null) => {
    if (!iso) return false;
    const t = new Date(iso).getTime();
    return !Number.isNaN(t) && now().getTime() - t <= MAX_AGE_MINUTES * 60 * 1000;
  };

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);

    let session = '', event = '', ids: string[] = [];
    try {
      const body = await req.json();
      session = String(body?.session ?? '');
      event = String(body?.event ?? '');
      ids = Array.isArray(body?.ids) ? body.ids.map((x: unknown) => String(x)) : [];
    } catch {
      return json({ ok: false, message: 'Invalid request.' }, 400);
    }
    if (!['TASK_ASSIGNED', 'TASK_REQUEST', 'REQUEST_RESPONDED'].includes(event) || ids.length === 0 || ids.length > MAX_IDS) {
      return json({ ok: false, message: 'Invalid request.' }, 400);
    }
    if (!session) return json({ ok: false, message: 'Not logged in.' }, 401);

    try {
      const caller = await deps.userFromSessionHash(await sha256Hex(session));
      if (!caller) return json({ ok: false, message: 'Not logged in.' }, 401);
      const isAdmin = caller.role === 'ADMIN';

      // Work out who should be emailed about what (each entry is one email)
      const planned: { refId: string; eventKey: string; recipientId: string; build: (to: MailUser) => Mail }[] = [];

      if (event === 'TASK_ASSIGNED') {
        for (const t of await deps.getTasks(ids)) {
          if (!isAdmin && t.created_by_id !== caller.id) continue;
          if (!t.assigned_to_id || t.assigned_to_id === t.created_by_id) continue;
          if (!isRecent(t.created_date)) continue;
          planned.push({ refId: String(t.id), eventKey: 'TASK_ASSIGNED', recipientId: t.assigned_to_id, build: to => assignedMail(deps.appUrl, t, to) });
        }
      } else {
        for (const r of await deps.getRequests(ids)) {
          if (event === 'TASK_REQUEST') {
            if (!isAdmin && r.requester_id !== caller.id) continue;
            if (!isRecent(r.created_at)) continue;
            planned.push({ refId: String(r.id), eventKey: 'TASK_REQUEST', recipientId: r.superior_id, build: to => requestMail(deps.appUrl, r, to) });
          } else {
            if (!isAdmin && r.superior_id !== caller.id) continue;
            if (r.status !== 'ACCEPTED' && r.status !== 'DECLINED') continue;
            if (!isRecent(r.updated_at || r.created_at)) continue;
            planned.push({ refId: String(r.id), eventKey: `REQUEST_${r.status}`, recipientId: r.requester_id, build: to => responseMail(deps.appUrl, r, to) });
          }
        }
      }

      const users = new Map((await deps.getUsers([...new Set(planned.map(p => p.recipientId))])).map(u => [u.id, u]));
      let sent = 0, skipped = 0;

      for (const p of planned) {
        const to = users.get(p.recipientId);
        if (!to || to.status !== 'ACTIVE' || !validEmail(to.email)) { skipped++; continue; }
        if (!(await deps.claim(p.eventKey, p.refId, to.id))) { skipped++; continue; }
        try {
          await deps.sendMail(p.build(to));
          sent++;
        } catch (err) {
          console.error('send-task-email: could not send to', to.id, err);
          skipped++;
        }
        if (sent + skipped < planned.length) await sleep(SEND_GAP_MS);
      }

      return json({ ok: true, sent, skipped });
    } catch (err) {
      console.error('send-task-email failed:', err);
      return json({ ok: false, message: 'Could not send emails.', detail: String((err as { message?: string })?.message ?? err).slice(0, 300) }, 500);
    }
  };
}
