/**
 * Impersonation state — when a Software Owner / Admin is viewing a customer's
 * tenant context. Drives the persistent banner + Exit button.
 *
 * Storage keys:
 *   business_id          → standard tenant context (set/cleared by switcher)
 *   impersonating         → '1' when this session is impersonating
 *   impersonating_name    → human label for the banner
 *   impersonating_return  → URL to return to on Exit (defaults to /platform)
 */

const KEYS = {
  active: 'impersonating',
  name: 'impersonating_name',
  ret: 'impersonating_return',
};

export function startImpersonation(businessId: string, businessName: string, returnTo: string = '/platform') {
  if (typeof window === 'undefined') return;
  localStorage.setItem('business_id', businessId);
  localStorage.removeItem('branch_id');
  localStorage.setItem(KEYS.active, '1');
  localStorage.setItem(KEYS.name, businessName);
  localStorage.setItem(KEYS.ret, returnTo);
  // Hard-reload so middleware-bound state (subscription banner, RBAC,
  // suggest context, etc.) all rebind to the new tenant cleanly.
  window.location.href = '/';
}

export function exitImpersonation() {
  if (typeof window === 'undefined') return;
  const ret = localStorage.getItem(KEYS.ret) || '/platform';
  localStorage.removeItem('business_id');
  localStorage.removeItem('branch_id');
  localStorage.removeItem(KEYS.active);
  localStorage.removeItem(KEYS.name);
  localStorage.removeItem(KEYS.ret);
  window.location.href = ret;
}

export function isImpersonating(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(KEYS.active) === '1';
}

export function impersonatingName(): string {
  if (typeof window === 'undefined') return '';
  return localStorage.getItem(KEYS.name) || '';
}
