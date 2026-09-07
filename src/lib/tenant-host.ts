/**
 * Host → tenant slug. Edge-safe (used by proxy.ts), no server-only imports.
 *
 *   marin.bookedin.co        → "marin"
 *   marin.localhost:3000     → "marin"
 *   bookedin.co / www / app  → null   (marketing + dashboard)
 *   *.vercel.app previews    → null
 *   anything else            → null   (custom domains are resolved in the
 *                                      tenant layout via findTenantByCustomDomain)
 */
const RESERVED = new Set(["www", "app", "api", "admin", "mail", "static", "assets"]);

export function tenantSlugFromHost(host: string | null | undefined, rootDomain: string): string | null {
  if (!host) return null;
  const h = host.toLowerCase().split(":")[0]!;
  const root = rootDomain.toLowerCase().split(":")[0]!;
  if (h === root) return null;
  if (!h.endsWith(`.${root}`)) return null;
  const sub = h.slice(0, -(root.length + 1));
  if (!sub || sub.includes(".")) return null; // only one level deep
  if (RESERVED.has(sub)) return null;
  if (!isValidSlug(sub)) return null;
  return sub;
}

export function isValidSlug(slug: string): boolean {
  return /^[a-z0-9](?:[a-z0-9-]{1,38}[a-z0-9])?$/.test(slug) && !RESERVED.has(slug);
}

export function tenantUrl(slug: string, rootDomain: string, path = "/"): string {
  const isLocal = rootDomain.startsWith("localhost");
  const proto = isLocal ? "http" : "https";
  return `${proto}://${slug}.${rootDomain}${path}`;
}

export function tenantHostLabel(slug: string, rootDomain: string): string {
  return `${slug}.${rootDomain.split(":")[0]}`;
}
