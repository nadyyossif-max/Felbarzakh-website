// functions/api/community/profile.js
// PATCH { bio?, avatar_url?, username? } -> updates the logged-in user's own profile.
import { getSessionUser } from './_lib/crypto.js';

const USERNAME_RE = /^[a-zA-Z0-9_\u0600-\u06FF]{3,24}$/;

export async function onRequestPatch(context) {
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

  const bio = body.bio != null ? String(body.bio).trim().slice(0, 300) : (user.bio || null);
  const avatarUrl = body.avatar_url != null ? String(body.avatar_url).trim().slice(0, 500) : (user.avatar_url || null);

  if (avatarUrl && !/^https:\/\//.test(avatarUrl)) {
    return json({ error: 'رابط الصورة لازم يبدأ بـ https://' }, 400);
  }

  let username = user.username;
  if (body.username != null) {
    const newUsername = String(body.username).trim();
    if (newUsername !== user.username) {
      if (!USERNAME_RE.test(newUsername)) {
        return json({ error: 'اسم المستخدم لازم يكون بين 3 و24 حرف (حروف، أرقام، أو _).' }, 400);
      }
      const existing = await db.prepare(
        'SELECT id FROM users WHERE username = ? AND id != ?'
      ).bind(newUsername, user.id).first();
      if (existing) {
        return json({ error: 'اسم المستخدم ده مستخدم بالفعل.' }, 409);
      }
      username = newUsername;
    }
  }

  await db.prepare(
    'UPDATE users SET username = ?, bio = ?, avatar_url = ? WHERE id = ?'
  ).bind(username, bio || null, avatarUrl || null, user.id).run();

  return json({ user: { ...user, username, bio: bio || null, avatar_url: avatarUrl || null } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
