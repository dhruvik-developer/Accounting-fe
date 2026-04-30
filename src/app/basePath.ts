const rawBaseUrl = import.meta.env.BASE_URL || '/';

export const appBasePath = rawBaseUrl.replace(/\/+$/, '');

export function stripAppBasePath(path: string) {
  if (!path) return '/';
  if (!appBasePath) return path;
  if (path === appBasePath) return '/';
  if (path.startsWith(`${appBasePath}/`)) return path.slice(appBasePath.length) || '/';
  if (path.startsWith(`${appBasePath}?`) || path.startsWith(`${appBasePath}#`)) {
    return `/${path.slice(appBasePath.length)}`;
  }
  return path;
}

export function appPath(path = '/') {
  if (/^(?:[a-z][a-z\d+\-.]*:|\/\/|#)/i.test(path)) return path;

  const normalized = path.startsWith('/') ? path : `/${path}`;
  if (!appBasePath) return normalized;
  if (normalized === appBasePath || normalized.startsWith(`${appBasePath}/`)) return normalized;

  return normalized === '/' ? `${appBasePath}/` : `${appBasePath}${normalized}`;
}
