// functions/api/community/likes.js
// POST { target_type: 'post'|'comment', target_id, reaction_type? }
// Toggles / changes the current user's reaction on a post or comment.
// reaction_type is one of: 'مفيد' | 'مثير_للتفكير' | 'اتفق' | 'مختلف_عليه'
// (defaults to 'اتفق' for backward compatibility with the old simple-like calls).
// - If the user has no reaction yet -> creates one.
// - If the user already reacted with the SAME type -> removes it (toggle off).
// - If the user already reacted with a DIFFERENT type -> updates it in place.
// Returns { reaction: <type>|null, counts: { <type>: n, ... }, total: n }
import { getSessionUser } from './_lib/crypto.js';

const REACTION_TYPES = ['مفيد', 'مثير_للتفكير', 'اتفق', 'مختلف_عليه'];

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
  const reactionType = REACTION_TYPES.includes(body.reaction_type) ? body.reaction_type : 'اتفق';
  if (!['post', 'comment'].includes(targetType) || !targetId) {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const table = targetType === 'post' ? 'posts' : 'comments';
  const exists = await db.prepare(`SELECT id FROM ${table} WHERE id = ?`).bind(targetId).first();
  if (!exists) return json({ error: 'العنصر غير موجود.' }, 404);

  const existing = await db.prepare(
    'SELECT id, reaction_type FROM likes WHERE user_id = ? AND target_type = ? AND target_id = ?'
  ).bind(user.id, targetType, targetId).first();

  let currentReaction;
  if (existing && existing.reaction_type === reactionType) {
    await db.prepare('DELETE FROM likes WHERE id = ?').bind(existing.id).run();
    currentReaction = null;
  } else if (existing) {
    await db.prepare('UPDATE likes SET reaction_type = ? WHERE id = ?').bind(reactionType, existing.id).run();
    currentReaction = reactionType;
  } else {
    await db.prepare(
      'INSERT INTO likes (user_id, target_type, target_id, reaction_type) VALUES (?, ?, ?, ?)'
    ).bind(user.id, targetType, targetId, reactionType).run();
    currentReaction = reactionType;
  }

  const { results } = await db.prepare(
    'SELECT reaction_type, COUNT(*) AS c FROM likes WHERE target_type = ? AND target_id = ? GROUP BY reaction_type'
  ).bind(targetType, targetId).all();

  const counts = {};
  REACTION_TYPES.forEach(t => { counts[t] = 0; });
  let total = 0;
  results.forEach(r => { counts[r.reaction_type] = r.c; total += r.c; });

  return json({ reaction: currentReaction, counts, total });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
