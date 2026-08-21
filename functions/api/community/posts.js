// functions/api/community/posts.js
// GET  ?cursor=<id>&category=<cat>  -> paginated list of posts (newest first)
// POST { title, body, category, related_episode_slug?, related_article_slug? }
//      -> creates a post (requires login)
import { getSessionUser } from './_lib/crypto.js';
import { awardPoints, checkAndAwardBadges } from './_lib/gamification.js';

const CATEGORIES = ['نقاش', 'اقتراح حلقة', 'مناقشة حلقة', 'فكرة', 'سؤال', 'كتاب / فيلم / موسيقى', 'أخرى'];
const PAGE_SIZE = 20;

export async function onRequestGet(context) {
  const { request, env } = context;
  const db = env.DB;
  const url = new URL(request.url);
  const cursor = url.searchParams.get('cursor');
  const category = url.searchParams.get('category');

  let query = `
    SELECT p.id, p.user_id, p.title, p.body, p.category, p.related_episode_slug, p.related_article_slug,
           p.image_url, p.is_pinned, p.created_at, u.username, u.avatar_url,
           (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) AS like_count,
           (SELECT COUNT(*) FROM comments WHERE post_id=p.id AND is_hidden=0) AS comment_count
    FROM posts p JOIN users u ON u.id = p.user_id
    WHERE p.is_hidden = 0
  `;
  const params = [];
  if (category && CATEGORIES.includes(category)) {
    query += ' AND p.category = ?';
    params.push(category);
  }
  if (cursor) {
    query += ' AND p.id < ?';
    params.push(parseInt(cursor, 10));
  }
  query += ' ORDER BY p.is_pinned DESC, p.id DESC LIMIT ?';
  params.push(PAGE_SIZE);

  const { results } = await db.prepare(query).bind(...params).all();
  const nextCursor = results.length === PAGE_SIZE ? results[results.length - 1].id : null;

  return json({ posts: results, next_cursor: nextCursor });
}

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

  const title = (body.title || '').trim();
  const content = (body.body || '').trim();
  const category = body.category;
  const relatedEpisode = body.related_episode_slug ? String(body.related_episode_slug).slice(0, 120) : null;
  const relatedArticle = body.related_article_slug ? String(body.related_article_slug).slice(0, 120) : null;
  const imageUrl = body.image_url ? String(body.image_url).slice(0, 500) : null;

  if (imageUrl && !imageUrl.startsWith('https://felbarzakh-website.pages.dev/images/community-uploads/')) {
    return json({ error: 'رابط صورة غير صالح.' }, 400);
  }

  if (title.length < 3 || title.length > 200) {
    return json({ error: 'عنوان المنشور لازم يكون بين 3 و200 حرف.' }, 400);
  }
  if (content.length < 5 || content.length > 8000) {
    return json({ error: 'محتوى المنشور لازم يكون بين 5 و8000 حرف.' }, 400);
  }
  if (!CATEGORIES.includes(category)) {
    return json({ error: 'تصنيف غير صالح.' }, 400);
  }

  const result = await db.prepare(
    `INSERT INTO posts (user_id, title, body, category, related_episode_slug, related_article_slug, image_url)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).bind(user.id, title, content, category, relatedEpisode, relatedArticle, imageUrl).run();

  await awardPoints(db, user.id, 5);
  await checkAndAwardBadges(db, user.id);

  return json({ post_id: result.meta.last_row_id }, 201);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
