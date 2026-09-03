import { SITE } from '@/lib/site';

export default function robots() {
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/admin', '/api/'] }],
    sitemap: `${SITE}/sitemap.xml`,
  };
}
