// functions/api/community/admin/posts.js
// PATCH { post_id, is_hidden?, is_pinned? } -> moderate a post (admin only)
import { getSessionUser } from '../_lib/crypto.js';

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user || !user.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'بيانات غير صالحة.' }, 400); }

  const postId = parseInt(body.post_id, 10);
  if (!postId) return json({ error: 'post_id غير صالح.' }, 400);

  const post = await db.prepare('SELECT id FROM posts WHERE id = ?').bind(postId).first();
  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  if (typeof body.is_hidden === 'boolean') {
    await db.prepare('UPDATE posts SET is_hidden = ? WHERE id = ?').bind(body.is_hidden ? 1 : 0, postId).run();
  }
  if (typeof body.is_pinned === 'boolean') {
    await db.prepare('UPDATE posts SET is_pinned = ? WHERE id = ?').bind(body.is_pinned ? 1 : 0, postId).run();
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
