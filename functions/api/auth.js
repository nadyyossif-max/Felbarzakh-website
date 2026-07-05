// functions/api/auth.js
// Starts the GitHub OAuth flow when Decap CMS's "Login" button is clicked.
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const clientId = env.GITHUB_CLIENT_ID;
  const redirectUri = `${url.origin}/api/callback`;

  const githubAuthUrl =
    `https://github.com/login/oauth/authorize` +
    `?client_id=${encodeURIComponent(clientId)}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=repo,user`;

  return Response.redirect(githubAuthUrl, 302);
}
