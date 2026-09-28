export function GET({ site }) {
  const body = `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /lab\n\nSitemap: ${new URL('/sitemap-index.xml', site)}\n`;
  return new Response(body, { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
