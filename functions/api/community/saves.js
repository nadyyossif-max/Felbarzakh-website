// functions/api/community/saves.js
// POST   { target_type: 'post'|'comment', target_id, note? } -> toggles save on/off.
//        If already saved and note is provided, updates the note instead of unsaving.
// GET    -> list current user's saved items (with post/comment details), newest first.
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
  const note = body.note ? String(body.note).trim().slice(0, 500) : null;
  if (!['post', 'comment'].includes(targetType) || !targetId) {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const table = targetType === 'post' ? 'posts' : 'comments';
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!exists) return json({ error: 'العنصر غير موجود.' }, 404);

  const existing = await db.prepare(
    'SELECT id FROM saves WHERE user_id = ? AND target_type = ? AND target_id = ?'
  ).bind(user.id, targetType, targetId).first();

  if (existing) {
    if (note !== null) {
      // editing the note on an already-saved item, not unsaving
      await db.prepare('UPDATE saves SET note = ? WHERE id = ?').bind(note, existing.id).run();
      return json({ saved: true, note });
    }
    await db.prepare('DELETE FROM saves WHERE id = ?').bind(existing.id).run();
    return json({ saved: false });
  }

  await db.prepare(
    'INSERT INTO saves (user_id, target_type, target_id, note) VALUES (?, ?, ?, ?)'
  ).bind(user.id, targetType, targetId, note).run();
  return json({ saved: true, note }, 201);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const { results } = await db.prepare(
    `SELECT s.id, s.target_type, s.target_id, s.note, s.created_at,
            p.title AS post_title, p.category AS post_category,
            c.body AS comment_body
     FROM saves s
     LEFT JOIN posts p ON s.target_type = 'post' AND p.id = s.target_id
     LEFT JOIN comments c ON s.target_type = 'comment' AND c.id = s.target_id
     WHERE s.user_id = ?
     ORDER BY s.id DESC`
  ).bind(user.id).all();

  return json({ saves: results });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
