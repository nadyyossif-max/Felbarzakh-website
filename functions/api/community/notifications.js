// functions/api/community/notifications.js
// GET   -> { notifications: [...], unread_count } for the current user (newest first, capped at 50).
// PATCH { notification_id? } -> marks one notification as read, or ALL if no id given.
import { getSessionUser } from './_lib/crypto.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const { results } = await db.prepare(
    'SELECT id, type, message, link, is_read, created_at FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT 50'
  ).bind(user.id).all();

  const unreadRow = await db.prepare(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0'
  ).bind(user.id).first();

  return json({ notifications: results, unread_count: unreadRow.c });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  let body = {};
  try { body = await request.json(); } catch { /* allow empty body = mark all */ }

  if (body.notification_id) {
    const id = parseInt(body.notification_id, 10);
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').bind(id, user.id).run();
  } else {
    await db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0').bind(user.id).run();
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
