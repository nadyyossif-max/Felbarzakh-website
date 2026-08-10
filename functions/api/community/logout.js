// functions/api/community/logout.js
// POST -> deletes the current session from the DB and clears the cookie.
import { readSessionToken, clearSessionCookie } from './_lib/crypto.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const token = readSessionToken(request);
  if (token) {
    await db.prepare('DELETE FROM sessions WHERE token = ?').bind(token).run();
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Set-Cookie': clearSessionCookie(),
    },
  });
}
