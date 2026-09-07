import "server-only";
import { headers } from "next/headers";

/**
 * The client flow is served two ways:
 *   marin.bookedin.co/b/…      (proxy rewrote to /s/marin/b/…)  → links are "/b/…"
 *   bookedin.co/s/marin/b/…    (preview from the dashboard)     → links need "/s/marin"
 * The proxy marks the first case with a request header.
 */
export async function clientBase(slug: string): Promise<string> {
  const h = await headers();
  return h.get("x-tenant-host") === "1" ? "" : `/s/${slug}`;
}

export const paths = {
  welcome: (base: string) => `${base || "/"}`,
  start: (base: string) => `${base}/start`,
  question: (base: string, bookingId: string, step: number) => `${base}/b/${bookingId}/q/${step}`,
  sign: (base: string, bookingId: string) => `${base}/b/${bookingId}/sign`,
  deposit: (base: string, bookingId: string) => `${base}/b/${bookingId}/deposit`,
  done: (base: string, bookingId: string) => `${base}/b/${bookingId}/done`,
  agreement: (base: string, bookingId: string) => `${base}/b/${bookingId}/agreement`,
};
