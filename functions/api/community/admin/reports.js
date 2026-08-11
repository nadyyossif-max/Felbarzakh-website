// functions/api/community/admin/reports.js
// GET   ?status=pending|resolved|dismissed (default pending) -> list reports with a preview of the reported content
// PATCH { report_id, status } -> mark a report resolved/dismissed (admin only)
import { getSessionUser } from '../_lib/crypto.js';

const STATUSES = ['pending', 'resolved', 'dismissed'];

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user || !user.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  const url = new URL(request.url);
  const status = url.searchParams.get('status') || 'pending';
  if (!STATUSES.includes(status)) return json({ error: 'status غير صالح.' }, 400);

  const { results } = await db.prepare(
    `SELECT r.id, r.target_type, r.target_id, r.reason, r.status, r.created_at,
            ru.username AS reporter_username,
            CASE WHEN r.target_type='post' THEN (SELECT title FROM posts WHERE id=r.target_id)
                 ELSE (SELECT body FROM comments WHERE id=r.target_id) END AS target_preview,
            CASE WHEN r.target_type='post' THEN (SELECT user_id FROM posts WHERE id=r.target_id)
                 ELSE (SELECT user_id FROM comments WHERE id=r.target_id) END AS target_author_id,
            CASE WHEN r.target_type='post' THEN (SELECT u2.username FROM posts p2 JOIN users u2 ON u2.id=p2.user_id WHERE p2.id=r.target_id)
                 ELSE (SELECT u2.username FROM comments c2 JOIN users u2 ON u2.id=c2.user_id WHERE c2.id=r.target_id) END AS target_author_username,
            CASE WHEN r.target_type='post' THEN (SELECT is_hidden FROM posts WHERE id=r.target_id)
                 ELSE (SELECT is_hidden FROM comments WHERE id=r.target_id) END AS target_hidden
     FROM reports r JOIN users ru ON ru.id = r.reporter_user_id
     WHERE r.status = ?
     ORDER BY r.id DESC LIMIT 50`
  ).bind(status).all();

  return json({ reports: results });
}

export async function onRequestPatch(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user || !user.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  let body;
  try { body = await request.json(); } catch { return json({ error: 'بيانات غير صالحة.' }, 400); }

  const reportId = parseInt(body.report_id, 10);
  const status = body.status;
  if (!reportId) return json({ error: 'report_id غير صالح.' }, 400);
  if (!STATUSES.includes(status)) return json({ error: 'status غير صالح.' }, 400);

  await db.prepare('UPDATE reports SET status = ? WHERE id = ?').bind(status, reportId).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
