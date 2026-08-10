// functions/api/community/session.js
// GET -> returns the currently logged-in user (or null), based on the cookie.
import { getSessionUser } from './_lib/crypto.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  return new Response(JSON.stringify({ user }), {
    status: 200,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
