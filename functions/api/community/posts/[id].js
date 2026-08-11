// functions/api/community/posts/[id].js
// GET    -> single post details
// DELETE -> deletes the post (only its own author, or an admin)
import { getSessionUser } from '../_lib/crypto.js';

export async function onRequestGet(context) {
  const { params, env } = context;
  const db = env.DB;
  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'رقم منشور غير صالح.' }, 400);

  const post = await db.prepare(
    `SELECT p.id, p.user_id, p.title, p.body, p.category, p.related_episode_slug, p.related_article_slug,
            p.image_url, p.is_pinned, p.created_at, u.username, u.avatar_url,
            (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) AS like_count
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ? AND p.is_hidden = 0`
  ).bind(id).first();

  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);
  return json({ post });
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const db = env.DB;
  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'رقم منشور غير صالح.' }, 400);

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const post = await db.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).first();
  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  if (post.user_id !== user.id && !user.is_admin) {
    return json({ error: 'مش مسموحلك تحذف المنشور ده.' }, 403);
  }

  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
