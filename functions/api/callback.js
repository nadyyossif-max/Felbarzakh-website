// functions/api/callback.js
// GitHub redirects here after the user approves the app. We exchange the
// temporary "code" for a real access token, then hand it back to the
// Decap CMS admin tab using the postMessage protocol it expects.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  if (!code) {
    return new Response('لا يوجد كود تفويض (code) من GitHub.', { status: 400 });
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
    }),
  });

  const tokenData = await tokenResponse.json();

  if (tokenData.error || !tokenData.access_token) {
    return new Response(
      'فشل تسجيل الدخول عبر GitHub: ' + (tokenData.error_description || tokenData.error || 'unknown error'),
      { status: 401 }
    );
  }

  const payload = JSON.stringify({ token: tokenData.access_token, provider: 'github' });

  const html = `<!DOCTYPE html>
<html>
<body>
<script>
(function() {
  function receiveMessage(e) {
    window.opener.postMessage(
      'authorization:github:success:${payload}',
      e.origin
    );
    window.removeEventListener('message', receiveMessage, false);
  }
  window.addEventListener('message', receiveMessage, false);
  window.opener.postMessage('authorizing:github', '*');
})();
</script>
تم تسجيل الدخول، تقدر تقفل الصفحة دي.
</body>
</html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}
