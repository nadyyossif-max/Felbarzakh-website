// functions/api/community/activity.js
// GET ?username=<name>  -> unified recent-activity timeline for that user
// (public — same privacy level as their profile: no private fields exposed).
// Combines: post created, comment written, item saved, badge earned.
// Capped at 30 most recent events.
const BADGE_LABELS = {
  first_step: 'أول خطوة',
  discussant: 'المحاور',
  reader: 'القارئ',
  explorer: 'المستكشف',
  council: 'عضو مجلس البرزخ',
};

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const username = (url.searchParams.get('username') || '').trim();
  if (!username) return json({ error: 'username مطلوب.' }, 400);

  const user = await db.prepare('SELECT id FROM users WHERE username = ? AND is_banned = 0').bind(username).first();
  if (!user) return json({ error: 'المستخدم غير موجود.' }, 404);

  const { results: posts } = await db.prepare(
    `SELECT 'post' AS kind, id, title AS detail, created_at FROM posts WHERE user_id = ? AND is_hidden = 0 ORDER BY id DESC LIMIT 15`
  ).bind(user.id).all();

  const { results: comments } = await db.prepare(
    `SELECT 'comment' AS kind, c.id, p.title AS detail, c.created_at
     FROM comments c JOIN posts p ON p.id = c.post_id
     WHERE c.user_id = ? AND c.is_hidden = 0 ORDER BY c.id DESC LIMIT 15`
  ).bind(user.id).all();

  const { results: saves } = await db.prepare(
    `SELECT 'save' AS kind, s.id,
            COALESCE(s.title, p.title, 'عنصر') AS detail, s.created_at
     FROM saves s LEFT JOIN posts p ON s.target_type = 'post' AND p.id = s.target_id
     WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 15`
  ).bind(user.id).all();

  const { results: badges } = await db.prepare(
    `SELECT 'badge' AS kind, id, badge_key AS detail, earned_at AS created_at
     FROM user_badges WHERE user_id = ? ORDER BY id DESC LIMIT 15`
  ).bind(user.id).all();

  const events = [...posts, ...comments, ...saves, ...badges]
    .map(e => ({
      kind: e.kind,
      created_at: e.created_at,
      message: formatMessage(e),
    }))
    .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
    .slice(0, 30);

  return json({ activity: events });
}

function formatMessage(e) {
  switch (e.kind) {
    case 'post': return `بدأ نقاشًا بعنوان "${e.detail}"`;
    case 'comment': return `شارك في نقاش "${e.detail}"`;
    case 'save': return `حفظ "${e.detail}"`;
    case 'badge': return `حصل على شارة "${BADGE_LABELS[e.detail] || e.detail}"`;
    default: return '';
  }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
