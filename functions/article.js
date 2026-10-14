// functions/article.js  ->  route: /article?title=<title>  (or ?i=<index>)
// Same idea as file.js, for articles. Matches the article the same way the
// page itself does: by exact title first, then by position in the list.
import { DEFAULT_DESC, plainExcerpt, plainRequest, rewriteHead } from './_lib/preview.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return context.next();

  const response = await context.next(plainRequest(request));
  try {
    const url = new URL(request.url);
    const wantedTitle = url.searchParams.get('title');
    const wantedIndex = url.searchParams.get('i');
    if (!wantedTitle && wantedIndex === null) return response;
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

    const dataRes = await env.ASSETS.fetch(new URL('/content/articles.json', url));
    if (!dataRes.ok) return response;
    const data = await dataRes.json();
    const list = Array.isArray(data.articles) ? data.articles : [];

    let article = null;
    if (wantedTitle) article = list.find(a => (a.title || '').trim() === wantedTitle.trim());
    if (!article && wantedIndex !== null) {
      const i = parseInt(wantedIndex, 10);
      if (!isNaN(i) && list[i]) article = list[i];
    }
    if (!article) return response;

    return rewriteHead(response, {
      title: `${article.title || 'مقال'} | في البرزخ`,
      description: plainExcerpt(article.description, 180) || DEFAULT_DESC,
      image: new URL(article.image || '/images/logo.jpg', url).href,
      url: `${url.origin}/article?title=${encodeURIComponent((article.title || '').trim())}`,
    });
  } catch (e) {
    return response;
  }
}
