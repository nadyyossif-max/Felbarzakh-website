// functions/file.js  ->  route: /file?slug=<slug>
// Serves the normal static file page, but with that file's own title,
// description and cover image in the <head> (for link previews and search).
// If anything goes wrong it quietly serves the unmodified page.
import { DEFAULT_DESC, plainExcerpt, plainRequest, rewriteHead } from './_lib/preview.js';

export async function onRequest(context) {
  const { request, env } = context;
  if (request.method !== 'GET') return context.next();

  const response = await context.next(plainRequest(request));
  try {
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    if (!slug) return response;
    if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

    const dataRes = await env.ASSETS.fetch(new URL('/content/files.json', url));
    if (!dataRes.ok) return response;
    const data = await dataRes.json();
    const item = (data.files || []).find(f => f.slug === slug);
    if (!item) return response;

    return rewriteHead(response, {
      title: `${item.title} | ملفات البرزخ`,
      description: plainExcerpt(item.short_description || item.intro, 180) || DEFAULT_DESC,
      image: new URL(item.cover_image || '/images/logo.jpg', url).href,
      url: `${url.origin}/file?slug=${encodeURIComponent(slug)}`,
    });
  } catch (e) {
    return response;
  }
}
