// functions/api/community/comments.js
// GET    ?post_id=<id>              -> all comments for a post (flat list, client groups by parent_comment_id)
// POST   { post_id, body, parent_comment_id? } -> create a comment or reply (requires login)
// DELETE { comment_id }             -> delete own comment (requires login)
import { getSessionUser } from './_lib/crypto.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const postId = parseInt(url.searchParams.get('post_id'), 10);
  if (!postId) return json({ error: 'post_id مطلوب.' }, 400);

  const currentUser = await getSessionUser(request, db);

  const { results } = await db.prepare(
    `SELECT c.id, c.user_id, c.body, c.parent_comment_id, c.created_at, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE target_type='comment' AND target_id=c.id) AS like_count
     FROM comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id = ? AND c.is_hidden = 0
     ORDER BY c.id ASC`
  ).bind(postId).all();

  if (currentUser && results.length) {
    const { results: myReactions } = await db.prepare(
      `SELECT target_id, reaction_type FROM likes
       WHERE user_id = ? AND target_type = 'comment' AND target_id IN (${results.map(() => '?').join(',')})`
    ).bind(currentUser.id, ...results.map(c => c.id)).all();
    const map = {};
    myReactions.forEach(r => { map[r.target_id] = r.reaction_type; });
    results.forEach(c => { c.my_reaction = map[c.id] || null; });
  } else {
    results.forEach(c => { c.my_reaction = null; });
  }

  return json({ comments: results });
}

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
  const content = (body.body || '').trim();
  const parentId = body.parent_comment_id ? parseInt(body.parent_comment_id, 10) : null;

  if (!postId) return json({ error: 'post_id غير صالح.' }, 400);
  if (content.length < 1 || content.length > 3000) {
    return json({ error: 'التعليق لازم يكون بين 1 و3000 حرف.' }, 400);
  }

  const post = await db.prepare('SELECT id FROM posts WHERE id = ? AND is_hidden = 0').bind(postId).first();
  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  if (parentId) {
    const parent = await db.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').bind(parentId, postId).first();
    if (!parent) return json({ error: 'التعليق الأصلي غير موجود.' }, 404);
  }

  const result = await db.prepare(
    'INSERT INTO comments (post_id, user_id, parent_comment_id, body) VALUES (?, ?, ?, ?)'
  ).bind(postId, user.id, parentId, content).run();

  return json({ comment_id: result.meta.last_row_id }, 201);
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

  const commentId = parseInt(body.comment_id, 10);
  if (!commentId) return json({ error: 'comment_id غير صالح.' }, 400);

  const comment = await db.prepare('SELECT user_id FROM comments WHERE id = ?').bind(commentId).first();
  if (!comment) return json({ error: 'التعليق غير موجود.' }, 404);

  if (comment.user_id !== user.id && !user.is_admin) {
    return json({ error: 'مش مسموحلك تحذف التعليق ده.' }, 403);
  }

  await db.prepare('DELETE FROM comments WHERE id = ?').bind(commentId).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
