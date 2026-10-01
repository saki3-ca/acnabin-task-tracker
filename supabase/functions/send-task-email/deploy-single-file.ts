// send-task-email: SINGLE-FILE version for pasting into the Supabase dashboard editor.
// (Same code as handler.ts + index.ts.)
import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

// Pure logic of the send-task-email Edge Function (no Deno / npm imports, so it can be tested).
//
// POST { session, event, ids }
//   event = TASK_ASSIGNED      ids = task ids       -> email to each assignee
//   event = TASK_REQUEST       ids = request ids    -> email to the person asked
//   event = REQUEST_RESPONDED  ids = request ids    -> email to the person who sent the request
//   event = PROPOSAL_ASSIGNED  ids = proposal ids   -> email to each person assigned to the proposal
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
export interface ProposalRow {
  id: string; name: string; client: string; type: string | null; deadline: string | null; status: string;
  remarks: string | null; assigned_ids: string[] | null; created_by: string | null; updated_at: string | null;
}
export interface Mail { to: string; subject: string; text: string; html: string }

export interface Deps {
  appUrl: string;
  userFromSessionHash(hash: string): Promise<CallerUser | null>;
  getTasks(ids: string[]): Promise<TaskRow[]>;
  getRequests(ids: string[]): Promise<RequestRow[]>;
  getUsers(ids: string[]): Promise<MailUser[]>;
  getProposals(ids: string[]): Promise<ProposalRow[]>;
  /** Admin, or someone the Admin gave the Proposal Tracker to */
  hasProposalAccess(userId: string): Promise<boolean>;
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

const fmtDay = (iso?: string | null) => {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

export function proposalMail(appUrl: string, p: ProposalRow, assignerName: string, to: MailUser, today: Date): Mail {
  let deadline = fmtDay(p.deadline);
  if (p.deadline) {
    const left = Math.round((new Date(`${p.deadline}T00:00:00Z`).getTime() - Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())) / 86400000);
    if (!Number.isNaN(left)) deadline += left < 0 ? ` (${-left} day${left === -1 ? '' : 's'} overdue)` : left === 0 ? ' (due today)' : ` (${left} day${left === 1 ? '' : 's'} left)`;
  }
  const m = layout(appUrl, to.name || 'there', `${assignerName || 'Someone'} assigned you a proposal.`, [
    ['Proposal', p.name], ['Client', p.client], ['Type', p.type || ''], ['Deadline', deadline], ['Status', p.status], ['Remarks', p.remarks || '']
  ]);
  return { to: to.email, subject: `New proposal assigned: ${clip(p.name, 80)}`, ...m };
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
    if (!['TASK_ASSIGNED', 'TASK_REQUEST', 'REQUEST_RESPONDED', 'PROPOSAL_ASSIGNED'].includes(event) || ids.length === 0 || ids.length > MAX_IDS) {
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
      } else if (event === 'PROPOSAL_ASSIGNED') {
        // The caller must be allowed to use the tracker. Recipients are the people saved on the proposal.
        if (!isAdmin && !(await deps.hasProposalAccess(caller.id))) return json({ ok: false, message: 'No access.' }, 403);
        for (const p of await deps.getProposals(ids)) {
          if (!isRecent(p.updated_at)) continue;
          for (const uid of p.assigned_ids || []) {
            if (uid === caller.id) continue; // no email to yourself
            planned.push({ refId: String(p.id), eventKey: 'PROPOSAL_ASSIGNED', recipientId: uid, build: to => proposalMail(deps.appUrl, p, caller.name, to, now()) });
          }
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

// Supabase Edge Function: send-task-email
//
// Emails people about task assignments, task requests and proposal assignments (see handler.ts for the rules).
//
// Secrets (already set for request-password-reset; Supabase Dashboard -> Edge Functions -> Secrets):
//   GMAIL_USER, GMAIL_APP_PASSWORD   (APP_URL is optional: defaults to https://acntask.vercel.app)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Also run supabase_email_log.sql once (it stops the same email being sent twice).


function requireEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required secret: ${name}`);
  return value;
}

function createProductionHandler() {
  const supabase = createClient(requireEnv('SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false }
  });
  const gmailUser = requireEnv('GMAIL_USER');
  const transporter = nodemailer.createTransport({
    host: Deno.env.get('SMTP_HOST') || 'smtp.gmail.com',
    port: Number(Deno.env.get('SMTP_PORT') || 465),
    secure: true,
    auth: { user: gmailUser, pass: requireEnv('GMAIL_APP_PASSWORD').replace(/\s+/g, '') }
  });

  const deps: Deps = {
    // APP_URL secret if set, otherwise the live site
    appUrl: Deno.env.get('APP_URL') || 'https://acntask.vercel.app',
    async userFromSessionHash(hash) {
      const { data: s, error } = await supabase
        .from('user_sessions').select('user_id').eq('token_hash', hash).gt('expires_at', new Date().toISOString()).maybeSingle();
      if (error) throw error;
      if (!s) return null;
      const { data: u, error: uErr } = await supabase
        .from('users').select('id, name, role, status').eq('id', s.user_id).maybeSingle();
      if (uErr) throw uErr;
      return u && u.status === 'ACTIVE' ? { id: u.id, name: u.name, role: u.role } : null;
    },
    async getTasks(ids) {
      const { data, error } = await supabase
        .from('tasks')
        .select('id, particular, client_name, priority, deadline, assigned_date, created_by_id, created_by_name, assigned_to_id, created_date')
        .in('id', ids);
      if (error) throw error;
      return data || [];
    },
    async getRequests(ids) {
      // select('*'): works whether or not the response_remarks column exists yet
      const { data, error } = await supabase.from('task_requests').select('*').in('id', ids);
      if (error) throw error;
      return data || [];
    },
    async getProposals(ids) {
      const { data, error } = await supabase
        .from('proposals')
        .select('id, name, client, type, deadline, status, remarks, assigned_ids, created_by, updated_at')
        .in('id', ids);
      if (error) throw error;
      return data || [];
    },
    async hasProposalAccess(userId) {
      const { data, error } = await supabase.from('proposal_access').select('user_id').eq('user_id', userId).maybeSingle();
      if (error) throw error;
      return Boolean(data);
    },
    async getUsers(ids) {
      if (ids.length === 0) return [];
      const { data, error } = await supabase.from('users').select('id, name, email, status').in('id', ids);
      if (error) throw error;
      return data || [];
    },
    async claim(event, refId, userId) {
      const { error } = await supabase.from('email_log').insert({ event, ref_id: refId, user_id: userId });
      if (!error) return true;
      if ((error as { code?: string }).code === '23505') return false; // already emailed
      throw error;
    },
    async sendMail(mail) {
      await transporter.sendMail({ from: `ACNABIN Task Tracker <${gmailUser}>`, ...mail });
    }
  };
  return createHandler(deps);
}

let handler: ((req: Request) => Promise<Response>) | null = null;

Deno.serve(async req => {
  try {
    handler ??= createProductionHandler();
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: 'Email is not configured.', detail: String((err as { message?: string })?.message ?? err).slice(0, 300) }, 500);
  }
  return handler(req);
});
