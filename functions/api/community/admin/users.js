// functions/api/community/admin/users.js
// PATCH { user_id, is_banned } -> ban/unban a user (admin only)
// A banned user's existing sessions are revoked immediately.
import { getSessionUser } from '../_lib/crypto.js';

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.DB;

  const admin = await getSessionUser(request, db);
  if (!admin || !admin.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'بيانات غير صالحة.' }, 400); }

  const userId = parseInt(body.user_id, 10);
  if (!userId) return json({ error: 'user_id غير صالح.' }, 400);
  if (typeof body.is_banned !== 'boolean') return json({ error: 'is_banned مطلوب.' }, 400);

  const target = await db.prepare('SELECT id, is_admin FROM users WHERE id = ?').bind(userId).first();
  if (!target) return json({ error: 'المستخدم غير موجود.' }, 404);
  if (target.is_admin) return json({ error: 'مينفعش تحظر أدمن.' }, 400);

  await db.prepare('UPDATE users SET is_banned = ? WHERE id = ?').bind(body.is_banned ? 1 : 0, userId).run();
  if (body.is_banned) {
    await db.prepare('DELETE FROM sessions WHERE user_id = ?').bind(userId).run();
  }

  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
