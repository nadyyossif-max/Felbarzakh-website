// functions/api/community/reports.js
// POST { target_type: 'post'|'comment', target_id, reason? } -> files a report
// (requires login). Reports are reviewed later from the admin/moderation panel.
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
  const reason = body.reason ? String(body.reason).trim().slice(0, 500) : null;

  if (!['post', 'comment'].includes(targetType) || !targetId) {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const table = targetType === 'post' ? 'posts' : 'comments';
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!exists) return json({ error: 'العنصر غير موجود.' }, 404);

  await db.prepare(
    'INSERT INTO reports (reporter_user_id, target_type, target_id, reason) VALUES (?, ?, ?, ?)'
  ).bind(user.id, targetType, targetId, reason).run();

  return json({ ok: true }, 201);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
