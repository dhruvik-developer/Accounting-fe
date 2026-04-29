export function checkoutRoute(shortUrl: string) {
  if (!shortUrl) return '';
  if (/^https?:\/\//.test(shortUrl)) {
    try {
      const parsed = new URL(shortUrl);
      return `${parsed.pathname}${parsed.search}${parsed.hash}` || '/';
    } catch {
      return shortUrl;
    }
  }
  return shortUrl.startsWith('/') ? shortUrl : `/${shortUrl}`;
}
