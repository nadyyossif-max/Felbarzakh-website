// functions/api/community/follows.js
// POST { post_id } -> toggles following that discussion on/off. Returns { following }.
// GET  ?post_id=<id> -> { following: true|false } for the current user on that post.
//      (no post_id) -> list of posts the current user follows.
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

  const postId = parseInt(body.post_id, 10);
  if (!postId) return json({ error: 'post_id غير صالح.' }, 400);

  const post = await db.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  const existing = await db.prepare(
    'SELECT id FROM post_follows WHERE user_id = ? AND post_id = ?'
  ).bind(user.id, postId).first();

  if (existing) {
    await db.prepare('DELETE FROM post_follows WHERE id = ?').bind(existing.id).run();
    return json({ following: false });
  }

  await db.prepare('INSERT INTO post_follows (user_id, post_id) VALUES (?, ?)').bind(user.id, postId).run();
  return json({ following: true }, 201);
}

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const postIdParam = url.searchParams.get('post_id');
  if (postIdParam) {
    const postId = parseInt(postIdParam, 10);
    const existing = await db.prepare(
      'SELECT id FROM post_follows WHERE user_id = ? AND post_id = ?'
    ).bind(user.id, postId).first();
    return json({ following: !!existing });
  }

  const { results } = await db.prepare(
    `SELECT f.post_id, f.created_at, p.title, p.category
     FROM post_follows f JOIN posts p ON p.id = f.post_id
     WHERE f.user_id = ? ORDER BY f.id DESC`
  ).bind(user.id).all();
  return json({ follows: results });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
