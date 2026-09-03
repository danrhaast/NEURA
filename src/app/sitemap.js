import { SITE } from '@/lib/site';

/* Site de página única: só a home entra. As seções são âncoras da mesma URL. */
export default function sitemap() {
  return [{ url: SITE, changeFrequency: 'weekly', priority: 1 }];
}
