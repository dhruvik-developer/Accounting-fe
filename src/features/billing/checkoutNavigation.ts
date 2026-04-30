import { stripAppBasePath } from '@/app/basePath';

export function checkoutRoute(shortUrl: string) {
  if (!shortUrl) return '';
  if (/^https?:\/\//.test(shortUrl)) {
    try {
      const parsed = new URL(shortUrl);
      return stripAppBasePath(`${parsed.pathname}${parsed.search}${parsed.hash}` || '/');
    } catch {
      return shortUrl;
    }
  }
  return stripAppBasePath(shortUrl.startsWith('/') ? shortUrl : `/${shortUrl}`);
}
