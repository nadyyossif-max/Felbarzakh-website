// functions/api/community/_lib/crypto.js
// Shared helpers: password hashing (PBKDF2 via Web Crypto) and session tokens.
const PBKDF2_ITERATIONS = 100000;

function bufToHex(buf) {
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function hexToBuf(hex) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  return bytes.buffer;
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bufToHex(bytes.buffer);
}

export async function hashPassword(password) {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const salt = bufToHex(saltBytes.buffer);
  const hash = await pbkdf2(password, salt);
  return { hash, salt };
}

export async function verifyPassword(password, salt, expectedHash) {
  const hash = await pbkdf2(password, salt);
  if (hash.length !== expectedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ expectedHash.charCodeAt(i);
  return diff === 0;
}

async function pbkdf2(password, saltHex) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), { name: 'PBKDF2' }, false, ['deriveBits']
  );
  const derived = await crypto.subtle.deriveBits(
    {
      name: 'PBKDF2',
      salt: hexToBuf(saltHex),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    256
  );
  return bufToHex(derived);
}

export function sessionCookie(token, maxAgeSeconds) {
  return `majlis_session=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

export function clearSessionCookie() {
  return `majlis_session=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

export function readSessionToken(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/majlis_session=([^;]+)/);
  return match ? match[1] : null;
}

export async function getSessionUser(request, db) {
  const token = readSessionToken(request);
  if (!token) return null;
  const session = await db.prepare(
    `SELECT s.user_id, s.expires_at, u.username, u.avatar_url, u.bio, u.is_admin, u.is_banned
     FROM sessions s JOIN users u ON u.id = s.user_id
     WHERE s.token = ?`
  ).bind(token).first();
  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;
  if (session.is_banned) return null;
  return {
    id: session.user_id,
    username: session.username,
    avatar_url: session.avatar_url,
    bio: session.bio,
    is_admin: !!session.is_admin,
  };
}
