// functions/api/community/posts/[id].js
// GET    -> single post details, including the current user's reaction (if any)
// PATCH  -> edits the post (only its own author, or an admin)
// DELETE -> deletes the post (only its own author, or an admin)
import { getSessionUser } from '../_lib/crypto.js';

const CATEGORIES = ['نقاش', 'اقتراح حلقة', 'مناقشة حلقة', 'فكرة', 'سؤال', 'كتاب / فيلم / موسيقى', 'أخرى'];

export async function onRequestGet(context) {
  const { request, params, env } = context;
  const db = env.DB;
  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'رقم منشور غير صالح.' }, 400);

  const currentUser = await getSessionUser(request, db);

  const post = await db.prepare(
    `SELECT p.id, p.user_id, p.title, p.body, p.category, p.related_episode_slug, p.related_article_slug,
            p.image_url, p.is_pinned, p.created_at, u.username, u.avatar_url, u.is_admin,
            (SELECT COUNT(*) FROM likes WHERE target_type='post' AND target_id=p.id) AS like_count
     FROM posts p JOIN users u ON u.id = p.user_id
     WHERE p.id = ? AND p.is_hidden = 0`
  ).bind(id).first();

  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  if (currentUser) {
    const myReaction = await db.prepare(
      'SELECT reaction_type FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?'
    ).bind(currentUser.id, 'post', id).first();
    post.my_reaction = myReaction ? myReaction.reaction_type : null;
  } else {
    post.my_reaction = null;
  }

  return json({ post });
}

export async function onRequestPatch(context) {
  const { request, params, env } = context;
  const db = env.DB;
  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'رقم منشور غير صالح.' }, 400);

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const existingPost = await db.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).first();
  if (!existingPost) return json({ error: 'المنشور غير موجود.' }, 404);

  if (existingPost.user_id !== user.id && !user.is_admin) {
    return json({ error: 'مش مسموحلك تعدّل المنشور ده.' }, 403);
  }

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

  if (title.length < 3 || title.length > 200) {
    return json({ error: 'عنوان المنشور لازم يكون بين 3 و200 حرف.' }, 400);
  }
  if (content.length < 5 || content.length > 8000) {
    return json({ error: 'محتوى المنشور لازم يكون بين 5 و8000 حرف.' }, 400);
  }
  if (!CATEGORIES.includes(category)) {
    return json({ error: 'تصنيف غير صالح.' }, 400);
  }

  await db.prepare(
    `UPDATE posts SET title = ?, body = ?, category = ?, related_episode_slug = ?, related_article_slug = ?
     WHERE id = ?`
  ).bind(title, content, category, relatedEpisode, relatedArticle, id).run();

  return json({ ok: true });
}

export async function onRequestDelete(context) {
  const { request, params, env } = context;
  const db = env.DB;
  const id = parseInt(params.id, 10);
  if (!id) return json({ error: 'رقم منشور غير صالح.' }, 400);

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  const post = await db.prepare('SELECT user_id FROM posts WHERE id = ?').bind(id).first();
  if (!post) return json({ error: 'المنشور غير موجود.' }, 404);

  if (post.user_id !== user.id && !user.is_admin) {
    return json({ error: 'مش مسموحلك تحذف المنشور ده.' }, 403);
  }

  await db.prepare('DELETE FROM posts WHERE id = ?').bind(id).run();
  return json({ ok: true });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
