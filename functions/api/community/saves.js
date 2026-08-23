// functions/api/community/saves.js
// Two modes:
//
// A) Saving a post/comment already in the system (toggle behaviour, same as before):
//    POST { target_type: 'post'|'comment', target_id, note? } -> toggles save on/off.
//    If already saved and note is provided, updates the note instead of unsaving.
//
// B) دفتر البرزخ — free-form notebook items with no DB record to point at
//    (an episode, an article, a link, or a quote the user typed themselves):
//    POST { target_type: 'episode'|'article'|'link'|'quote', title, url?, note? }
//    -> always creates a new row (no toggle concept — use DELETE to remove one).
//
// DELETE { save_id } -> removes any of the current user's saved items.
// GET    -> list current user's saved items (post/comment details joined; title/url as-is for notebook items), newest first.
import { getSessionUser } from './_lib/crypto.js';

const DB_TARGET_TYPES = ['post', 'comment'];
const NOTEBOOK_TARGET_TYPES = ['episode', 'article', 'link', 'quote'];

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
  const note = body.note ? String(body.note).trim().slice(0, 500) : null;

  if (DB_TARGET_TYPES.includes(targetType)) {
    const targetId = parseInt(body.target_id, 10);
    if (!targetId) return json({ error: 'بيانات غير صالحة.' }, 400);

    const table = targetType === 'post' ? 'posts' : 'comments';
    const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
    if (!exists) return json({ error: 'العنصر غير موجود.' }, 404);

    const existing = await db.prepare(
      'SELECT id FROM saves WHERE user_id = ? AND target_type = ? AND target_id = ?'
    ).bind(user.id, targetType, targetId).first();

    if (existing) {
      if (note !== null) {
        await db.prepare('UPDATE saves SET note = ? WHERE id = ?').bind(note, existing.id).run();
        return json({ saved: true, note });
      }
      await db.prepare('DELETE FROM saves WHERE id = ?').bind(existing.id).run();
      return json({ saved: false });
    }

    const result = await db.prepare(
      'INSERT INTO saves (user_id, target_type, target_id, note) VALUES (?, ?, ?, ?)'
    ).bind(user.id, targetType, targetId, note).run();
    return json({ saved: true, note, id: result.meta.last_row_id }, 201);
  }

  if (NOTEBOOK_TARGET_TYPES.includes(targetType)) {
    const title = (body.title || '').trim();
    const url = body.url ? String(body.url).trim().slice(0, 500) : null;
    if (title.length < 1 || title.length > 200) {
      return json({ error: 'العنوان لازم يكون بين 1 و200 حرف.' }, 400);
    }
    if (url && !/^https?:\/\//i.test(url)) {
      return json({ error: 'الرابط لازم يبدأ بـ http:// أو https://' }, 400);
    }
    const result = await db.prepare(
      'INSERT INTO saves (user_id, target_type, title, url, note) VALUES (?, ?, ?, ?, ?)'
    ).bind(user.id, targetType, title, url, note).run();
    return json({ saved: true, id: result.meta.last_row_id }, 201);
  }

  return json({ error: 'بيانات غير صالحة.' }, 400);
}

export async function onRequestDelete(context) {
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

  const saveId = parseInt(body.save_id, 10);
  if (!saveId) return json({ error: 'save_id غير صالح.' }, 400);

  const existing = await db.prepare('SELECT user_id FROM saves WHERE id = ?').bind(saveId).first();
  if (!existing) return json({ error: 'العنصر غير موجود.' }, 404);
  if (existing.user_id !== user.id) return json({ error: 'مش مسموحلك تحذف العنصر ده.' }, 403);

  await db.prepare('DELETE FROM saves WHERE id = ?').bind(saveId).run();
  return json({ ok: true });
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const { results } = await db.prepare(
    `SELECT s.id, s.target_type, s.target_id, s.title, s.url, s.note, s.created_at,
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
