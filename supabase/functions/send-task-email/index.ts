// Supabase Edge Function: send-task-email
//
// Emails people about task assignments and task requests (see handler.ts for the rules).
//
// Secrets (already set for request-password-reset; Supabase Dashboard -> Edge Functions -> Secrets):
//   GMAIL_USER, GMAIL_APP_PASSWORD   (APP_URL is optional: defaults to https://acntask.vercel.app)
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.
// Also run supabase_email_log.sql once (it stops the same email being sent twice).

import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';
import { createHandler, json, type Deps } from './handler.ts';

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
