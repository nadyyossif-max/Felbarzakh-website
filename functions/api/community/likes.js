// functions/api/community/likes.js
// POST { target_type: 'post'|'comment', target_id } -> toggles the current
// user's like on/off. Returns { liked: true|false, like_count }.
import { getSessionUser } from './_lib/crypto.js';

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const targetType = body.target_type;
  const targetId = parseInt(body.target_id, 10);
  if (!['post', 'comment'].includes(targetType) || !targetId) {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const table = targetType === 'post' ? 'posts' : 'comments';
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!exists) return json({ error: 'العنصر غير موجود.' }, 404);

  const existingLike = await db.prepare(
    'SELECT id FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?'
  ).bind(user.id, targetType, targetId).first();

  let liked;
  if (existingLike) {
    await db.prepare('DELETE FROM likes WHERE id = ?').bind(existingLike.id).run();
    liked = false;
  } else {
    await db.prepare(
      'INSERT INTO likes (user_id, target_type, target_id) VALUES (?, ?, ?)'
    ).bind(user.id, targetType, targetId).run();
    liked = true;
  }

  const countRow = await db.prepare(
    'SELECT COUNT(*) AS c FROM likes WHERE target_type = ? AND target_id = ?'
  ).bind(targetType, targetId).first();

  return json({ liked, like_count: countRow.c });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
