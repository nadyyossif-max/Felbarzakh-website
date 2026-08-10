// functions/api/community/register.js
// POST { username, email, password } -> creates a user + session, sets cookie.
// Completely separate from functions/api/auth.js (Decap CMS / GitHub OAuth) —
// does not touch it, does not share any state with it.
import { hashPassword, randomToken, sessionCookie } from './_lib/crypto.js';

const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,24}$/;
const SESSION_DAYS = 30;

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const username = (body.username || '').trim();
  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!USERNAME_RE.test(username)) {
    return json({ error: 'اسم المستخدم لازم يكون بين 3 و24 حرف (حروف، أرقام، أو _).' }, 400);
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return json({ error: 'البريد الإلكتروني غير صالح.' }, 400);
  }
  if (password.length < 8 || password.length > 128) {
    return json({ error: 'كلمة المرور لازم تكون 8 حروف على الأقل.' }, 400);
  }

  const existing = await db.prepare(
    'SELECT id FROM users WHERE username = ? OR email = ?'
  ).bind(username, email).first();
  if (existing) {
    return json({ error: 'اسم المستخدم أو البريد الإلكتروني مستخدم بالفعل.' }, 409);
  }

  const { hash, salt } = await hashPassword(password);

  const result = await db.prepare(
    'INSERT INTO users (username, email, password_hash, password_salt) VALUES (?, ?, ?, ?)'
  ).bind(username, email, hash, salt).run();

  const userId = result.meta.last_row_id;
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();

  await db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, userId, expiresAt).run();

  return json(
    { user: { id: userId, username, avatar_url: null, bio: null, is_admin: false } },
    201,
    { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) }
  );
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}
