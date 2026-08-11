// functions/api/community/upload-image.js
// POST multipart/form-data with a single field "image" -> uploads the file to
// the GitHub repo (images/community-uploads/<random>.<ext>) using a token
// scoped ONLY to Contents read/write on this repo (GITHUB_UPLOAD_TOKEN) —
// completely separate from the Decap CMS OAuth flow in auth.js/callback.js.
// Returns { url } once GitHub confirms the commit. The file becomes live on
// the site after Cloudflare Pages finishes its automatic redeploy (roughly
// 10-30 seconds later), since this is a static-hosted repo.
import { getSessionUser } from './_lib/crypto.js';

const REPO_OWNER = 'nadyyossif-max';
const REPO_NAME = 'Felbarzakh-website';
const REPO_BRANCH = 'main';
const MAX_BYTES = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export async function onRequestPost(context) {
  const { request, env } = context;
  const db = env.DB;

  const user = await getSessionUser(request, db);
  if (!user) return json({ error: 'لازم تسجل دخول الأول.' }, 401);

  if (!env.GITHUB_UPLOAD_TOKEN) {
    return json({ error: 'رفع الصور مش مفعّل على السيرفر لسه.' }, 500);
  }

  let formData;
  try {
    formData = await request.formData();
  } catch {
    return json({ error: 'بيانات غير صالحة.' }, 400);
  }

  const file = formData.get('image');
  if (!file || typeof file === 'string') {
    return json({ error: 'لازم ترفع صورة.' }, 400);
  }
  if (!ALLOWED_TYPES[file.type]) {
    return json({ error: 'نوع الصورة مش مدعوم. استخدم JPG أو PNG أو WEBP أو GIF.' }, 400);
  }
  if (file.size > MAX_BYTES) {
    return json({ error: 'الصورة أكبر من 5 ميجا.' }, 400);
  }

  const ext = ALLOWED_TYPES[file.type];
  const filename = `${crypto.randomUUID()}.${ext}`;
  const repoPath = `images/community-uploads/${filename}`;

  const buffer = await file.arrayBuffer();
  const base64Content = arrayBufferToBase64(buffer);

  const ghRes = await fetch(
    `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${repoPath}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${env.GITHUB_UPLOAD_TOKEN}`,
        'User-Agent': 'felbarzakh-community-upload',
        Accept: 'application/vnd.github+json',
      },
      body: JSON.stringify({
        message: `صورة مجتمع من ${user.username}`,
        content: base64Content,
        branch: REPO_BRANCH,
      }),
    }
  );

  if (!ghRes.ok) {
    const errText = await ghRes.text();
    console.error('GitHub upload failed:', ghRes.status, errText);
    return json({ error: 'تعذر رفع الصورة، حاول تاني.' }, 502);
  }

  const publicUrl = `https://felbarzakh-website.pages.dev/${repoPath}`;
  return json({ url: publicUrl }, 201);
}

function arrayBufferToBase64(buffer) {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
