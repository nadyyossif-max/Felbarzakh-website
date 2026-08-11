// functions/api/community/admin/stats.js
// GET -> basic activity counts for the admin dashboard header (admin only)
import { getSessionUser } from '../_lib/crypto.js';

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user || !user.is_admin) return json({ error: 'مش مسموحلك.' }, 403);

  const [pendingReports, totalPosts, totalComments, totalUsers, bannedUsers] = await Promise.all([
    db.prepare(`SELECT COUNT(*) AS n FROM reports WHERE status = 'pending'`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM posts WHERE is_hidden = 0`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM comments WHERE is_hidden = 0`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM users`).first(),
    db.prepare(`SELECT COUNT(*) AS n FROM users WHERE is_banned = 1`).first(),
  ]);

  return json({
    pending_reports: pendingReports.n,
    total_posts: totalPosts.n,
    total_comments: totalComments.n,
    total_users: totalUsers.n,
    banned_users: bannedUsers.n,
  });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
