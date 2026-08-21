// functions/api/community/users/[username].js
// GET -> public profile for a username: basic info + stats + their recent posts.
// Never exposes email, password data, or any private field.
export async function onRequestGet(context) {
  const { params, env } = context;
  const db = env.DB;
  const username = (params.username || '').trim();
  if (!username) return json({ error: 'اسم مستخدم غير صالح.' }, 400);

  const user = await db.prepare(
    'SELECT id, username, avatar_url, bio, created_at, reputation FROM users WHERE username = ? AND is_banned = 0'
  ).bind(username).first();
  if (!user) return json({ error: 'المستخدم غير موجود.' }, 404);

  const { results: badges } = await db.prepare(
    'SELECT badge_key, earned_at FROM user_badges WHERE user_id = ? ORDER BY id ASC'
  ).bind(user.id).all();

  const { results: posts } = await db.prepare(
    `SELECT p.id, p.title, p.category, p.created_at,
            (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) AS like_count,
            (SELECT COUNT(*) FROM comments WHERE post_id=p.id AND is_hidden=0) AS comment_count
     FROM posts p
     WHERE p.user_id = ? AND p.is_hidden = 0
     ORDER BY p.id DESC LIMIT 20`
  ).bind(user.id).all();

  const postsCountRow = await db.prepare(
    'SELECT COUNT(*) AS c FROM posts WHERE user_id = ? AND is_hidden = 0'
  ).bind(user.id).first();

  const commentsCountRow = await db.prepare(
    'SELECT COUNT(*) AS c FROM comments WHERE user_id = ? AND is_hidden = 0'
  ).bind(user.id).first();

  // reactions this user has RECEIVED, across all their posts and comments
  const reactionsReceivedRow = await db.prepare(
    `SELECT COUNT(*) AS c FROM likes l
     WHERE (l.target_type = 'post' AND l.target_id IN (SELECT id FROM posts WHERE user_id = ?))
        OR (l.target_type = 'comment' AND l.target_id IN (SELECT id FROM comments WHERE user_id = ?))`
  ).bind(user.id, user.id).first();

  const stats = {
    posts_count: postsCountRow.c,
    comments_count: commentsCountRow.c,
    reactions_received: reactionsReceivedRow.c,
  };

  return json({ user, stats, posts, badges });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
