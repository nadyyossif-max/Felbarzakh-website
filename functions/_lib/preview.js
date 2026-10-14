// functions/_lib/preview.js
// Shared helpers for the per-item share previews (file.js / article.js).
// The static pages are rendered by JavaScript in the browser, so crawlers
// (WhatsApp, Facebook, Google) only ever saw the generic <head>. These helpers
// let a Pages Function swap in the real title / description / image per item.

export const DEFAULT_DESC = 'في البرزخ — قناة وثائقية وكاتب سيناريو يوسف السليني.';

// Plain-text excerpt from text or markdown (drops headings, the byline, links, symbols).
export function plainExcerpt(text, max = 180) {
  const s = String(text || '')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^#{1,6}\s.*$/gm, ' ')
    .replace(/^\s*\**\s*بقلم[^\n]*$/gm, ' ')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^[>\-*\s]+/gm, '')
    .replace(/[*_`~]+/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (s.length <= max) return s;
  const cut = s.slice(0, max);
  const lastSpace = cut.lastIndexOf(' ');
  return (lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut) + '…';
}

function escAttr(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Rewrites the <head> of the static page's response with the item's own data.
export function rewriteHead(response, { title, description, image, url }) {
  const rewritten = new HTMLRewriter()
    .on('title', { element(e) { e.setInnerContent(title); } })
    .on('meta[property="og:title"]', { element(e) { e.setAttribute('content', title); } })
    .on('meta[property="og:description"]', { element(e) { e.setAttribute('content', description); } })
    .on('meta[property="og:image"]', { element(e) { e.setAttribute('content', image); } })
    .on('meta[property="og:url"]', { element(e) { e.setAttribute('content', url); } })
    .on('head', {
      element(e) {
        // the static pages have no meta description / canonical of their own
        e.append(
          `<meta name="description" content="${escAttr(description)}">` +
          `<link rel="canonical" href="${escAttr(url)}">`,
          { html: true }
        );
      },
    })
    .transform(response);

  // the body changed, so the original validators/length no longer apply
  const headers = new Headers(rewritten.headers);
  headers.delete('etag');
  headers.delete('content-length');
  return new Response(rewritten.body, {
    status: rewritten.status,
    statusText: rewritten.statusText,
    headers,
  });
}

// Ask the static layer for the page without conditional-request headers,
// so we always get the full HTML (never an empty 304) to rewrite.
export function plainRequest(request) {
  const headers = new Headers(request.headers);
  headers.delete('if-none-match');
  headers.delete('if-modified-since');
  return new Request(request.url, { method: 'GET', headers });
}
