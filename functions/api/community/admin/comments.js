// functions/api/community/admin/comments.js
// PATCH { comment_id, is_hidden } -> hide/unhide a comment (admin only)
import { getSessionUser } from '../_lib/crypto.js';

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user || !user.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'بيانات غير صالحة.' }, 400); }

  const commentId = parseInt(body.comment_id, 10);
  if (!commentId) return json({ error: 'comment_id غير صالح.' }, 400);
  if (typeof body.is_hidden !== 'boolean') return json({ error: 'is_hidden مطلوب.' }, 400);

  const comment = await db.prepare('SELECT id FROM comments WHERE id = ?').bind(commentId).first();
  if (!comment) return json({ error: 'التعليق غير موجود.' }, 404);

  await db.prepare('UPDATE comments SET is_hidden = ? WHERE id = ?').bind(body.is_hidden ? 1 : 0, commentId).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
