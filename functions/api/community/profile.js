// functions/api/community/profile.js
// PATCH { bio?, avatar_url? } -> updates the logged-in user's own profile.
import { getSessionUser } from './_lib/crypto.js';

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

  await db.prepare(
    'UPDATE users SET bio = ?, avatar_url = ? WHERE id = ?'
  ).bind(bio || null, avatarUrl || null, user.id).run();

  return json({ user: { ...user, bio: bio || null, avatar_url: avatarUrl || null } });
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
