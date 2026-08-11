// functions/api/community/users/[username].js
// GET -> public profile for a username: basic info + their recent posts.
export async function onRequestGet(context) {
  const { params, env } = context;
  const db = env.DB;
  const username = (params.username || '').trim();
  if (!username) return json({ error: 'اسم مستخدم غير صالح.' }, 400);

  const user = await db.prepare(
    'SELECT id, username, avatar_url, bio, created_at FROM users WHERE username = ? AND is_banned = 0'
  ).bind(username).first();
  if (!user) return json({ error: 'المستخدم غير موجود.' }, 404);

  const { results: posts } = await db.prepare(
    `SELECT p.id, p.title, p.category, p.created_at,
            (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) AS like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id=p.id AND is_hidden=0) AS comment_count
     FROM posts p
     WHERE p.user_id = ? AND p.is_hidden = 0
     ORDER BY p.id DESC LIMIT 20`
  ).bind(user.id).all();

  return json({ user, posts });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
