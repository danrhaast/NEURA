const SITE = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

/* Site de página única: só a home entra. As seções são âncoras da mesma URL. */
export default function sitemap() {
  return [{ url: SITE, changeFrequency: 'weekly', priority: 1 }];
}
