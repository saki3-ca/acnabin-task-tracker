// Supabase Edge Function: request-password-reset
//
// POST { email } -> emails a one-time password reset link to every active
// account registered with that address. Always answers with the same generic
// response so the form can't be used to discover which emails have accounts.
//
// Secrets (Supabase Dashboard -> Edge Functions -> Secrets):
//   GMAIL_USER          the Gmail address that sends the emails
//   GMAIL_APP_PASSWORD  16-character Google App Password for that account
//   APP_URL             public URL of the app, e.g. https://tracker.example.com
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are provided by Supabase.

import { createClient } from 'npm:@supabase/supabase-js@2';
import nodemailer from 'npm:nodemailer@6.9.16';

const TOKEN_TTL_MINUTES = 60;
const MAX_REQUESTS_PER_HOUR = 3;
const MAX_ACCOUNTS_PER_EMAIL = 5;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

const GENERIC_RESPONSE = {
  ok: true,
  message: 'If an account is registered with that email, a reset link has been sent.'
};

export interface ResetAccount {
  id: string;
  name: string;
  emp_id: string;
  email: string;
}

export interface ResetDeps {
  appUrl: string;
  findActiveAccountsByEmail(email: string): Promise<ResetAccount[]>;
  countRecentTokens(userId: string, since: Date): Promise<number>;
  insertToken(row: { token_hash: string; user_id: string; expires_at: string }): Promise<void>;
  sendMail(msg: { to: string; subject: string; text: string; html: string }): Promise<void>;
  now?: () => Date;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
  });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

export function buildResetLink(appUrl: string, token: string): string {
  const url = new URL(appUrl);
  url.searchParams.set('reset_token', token);
  return url.toString();
}

export function createHandler(deps: ResetDeps) {
  const now = deps.now ?? (() => new Date());

  return async (req: Request): Promise<Response> => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
    if (req.method !== 'POST') return json({ ok: false, message: 'Method not allowed' }, 405);

    let email = '';
    try {
      const body = await req.json();
      email = String(body?.email ?? '').trim().toLowerCase();
    } catch {
      return json({ ok: false, message: 'Invalid request.' }, 400);
    }
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return json({ ok: false, message: 'Please enter a valid email address.' }, 400);
    }

    try {
      const accounts = (await deps.findActiveAccountsByEmail(email)).slice(0, MAX_ACCOUNTS_PER_EMAIL);

      for (const account of accounts) {
        const current = now();
        const recent = await deps.countRecentTokens(account.id, new Date(current.getTime() - 60 * 60 * 1000));
        if (recent >= MAX_REQUESTS_PER_HOUR) {
          console.warn(`Reset rate limit hit for user ${account.id}`);
          continue;
        }

        const token = randomToken();
        await deps.insertToken({
          token_hash: await sha256Hex(token),
          user_id: account.id,
          expires_at: new Date(current.getTime() + TOKEN_TTL_MINUTES * 60 * 1000).toISOString()
        });

        const link = buildResetLink(deps.appUrl, token);
        const name = account.name || 'there';
        const idLine = account.emp_id ? ` (${account.emp_id})` : '';
        await deps.sendMail({
          to: account.email,
          subject: 'Reset your ACNABIN Task Tracker password',
          text:
            `Hi ${name},\n\n` +
            `We received a request to reset the password for your account${idLine}.\n\n` +
            `Open this link to choose a new password (valid for ${TOKEN_TTL_MINUTES} minutes, single use):\n${link}\n\n` +
            `If you didn't request this, you can ignore this email; your password won't change.\n`,
          html:
            `<p>Hi ${escapeHtml(name)},</p>` +
            `<p>We received a request to reset the password for your account${escapeHtml(idLine)}.</p>` +
            `<p><a href="${escapeHtml(link)}">Choose a new password</a></p>` +
            `<p style="color:#666;font-size:13px">This link is valid for ${TOKEN_TTL_MINUTES} minutes and can be used once. ` +
            `If you didn't request this, you can ignore this email; your password won't change.</p>`
        });
      }
    } catch (err) {
      // Logged for the Supabase function logs; the caller still gets the generic
      // answer so failures don't reveal whether the email has an account.
      console.error('Password reset request failed:', err);
    }

    return json(GENERIC_RESPONSE);
  };
}

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
    port: Number(Deno.env.get('SMTP_PORT') || 465), // Edge Functions block ports 25 and 587
    secure: true,
    auth: { user: gmailUser, pass: requireEnv('GMAIL_APP_PASSWORD').replace(/\s+/g, '') }
  });

  return createHandler({
    appUrl: requireEnv('APP_URL'),
    async findActiveAccountsByEmail(email) {
      // Escape LIKE wildcards so the case-insensitive match is exact.
      const pattern = email.replace(/[\\%_]/g, c => `\\${c}`);
      const { data, error } = await supabase
        .from('users')
        .select('id, name, emp_id, email, status')
        .ilike('email', pattern)
        .eq('status', 'ACTIVE')
        .limit(MAX_ACCOUNTS_PER_EMAIL);
      if (error) throw error;
      return (data || []) as ResetAccount[];
    },
    async countRecentTokens(userId, since) {
      const { count, error } = await supabase
        .from('password_reset_tokens')
        .select('token_hash', { count: 'exact', head: true })
        .eq('user_id', userId)
        .gte('created_at', since.toISOString());
      if (error) throw error;
      return count ?? 0;
    },
    async insertToken(row) {
      const { error } = await supabase.from('password_reset_tokens').insert(row);
      if (error) throw error;
    },
    async sendMail(msg) {
      await transporter.sendMail({ from: `ACNABIN Task Tracker <${gmailUser}>`, ...msg });
    }
  });
}

let handler: ((req: Request) => Promise<Response>) | null = null;

Deno.serve(async req => {
  try {
    handler ??= createProductionHandler();
  } catch (err) {
    console.error(err);
    return json({ ok: false, message: 'Password reset is not configured. Contact an administrator.' }, 500);
  }
  return handler(req);
});
