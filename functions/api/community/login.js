// functions/api/community/login.js
// POST { email, password } -> verifies credentials, creates a session, sets cookie.
import { verifyPassword, randomToken, sessionCookie } from './_lib/crypto.js';
import { verifyTurnstile } from './_lib/turnstile.js';

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

  const turnstileToken = body.turnstile_token;
  const remoteIp = request.headers.get('CF-Connecting-IP');
  const humanVerified = await verifyTurnstile(turnstileToken, env.TURNSTILE_SECRET_KEY, remoteIp);
  if (!humanVerified) {
    return json({ error: 'تحقق الحماية من البوتات فشل، حاول تاني.' }, 403);
  }

  const email = (body.email || '').trim().toLowerCase();
  const password = body.password || '';

  if (!email || !password) {
    return json({ error: 'البريد الإلكتروني وكلمة المرور مطلوبين.' }, 400);
  }

  const user = await db.prepare(
    'SELECT id, username, password_hash, password_salt, avatar_url, bio, is_admin, is_banned FROM users WHERE email = ?'
  ).bind(email).first();

  if (!user) {
    return json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, 401);
  }

  const valid = await verifyPassword(password, user.password_salt, user.password_hash);
  if (!valid) {
    return json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' }, 401);
  }

  if (user.is_banned) {
    return json({ error: 'هذا الحساب محظور.' }, 403);
  }

  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000).toISOString();
  await db.prepare(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)'
  ).bind(token, user.id, expiresAt).run();

  return json(
    {
      user: {
        id: user.id,
        username: user.username,
        avatar_url: user.avatar_url,
        bio: user.bio,
        is_admin: !!user.is_admin,
      },
    },
    200,
    { 'Set-Cookie': sessionCookie(token, SESSION_DAYS * 86400) }
  );
}

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...extraHeaders },
  });
}
