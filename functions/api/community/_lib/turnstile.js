// functions/api/community/_lib/turnstile.js
// Verifies a Turnstile token against Cloudflare's siteverify endpoint.
// Returns true/false. Never throws — callers should treat any failure
// (network error, missing token, invalid response) as "not verified".
export async function verifyTurnstile(token, secretKey, remoteIp) {
  if (!token || !secretKey) return false;

  const body = new URLSearchParams();
  body.set('secret', secretKey);
  body.set('response', token);
  if (remoteIp) body.set('remoteip', remoteIp);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}
