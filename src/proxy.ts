import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { tenantSlugFromHost } from "@/lib/tenant-host";

/**
 * Request proxy (Next 16's name for middleware). Two jobs:
 *
 *  1. Tenant routing. `marin.bookedin.co/anything` is rewritten to
 *     `/s/marin/anything` so the tenant lives in the URL for the app tree.
 *     The client flow never leaves the photographer's domain — and never
 *     touches Clerk.
 *  2. Auth. Clerk runs only on photographer-side routes. Marketing pages,
 *     client links and webhooks are served without it.
 */
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_ROOT_DOMAIN ?? "localhost:3000";

/** Routes where Clerk's middleware must run (anything that calls auth()). */
const usesClerk = createRouteMatcher([
  "/dashboard(.*)",
  "/setup(.*)",
  "/onboarding(.*)",
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/api/stripe/connect(.*)",
  "/api/billing(.*)",
]);

/** Subset of the above that requires a signed-in user. */
const isProtected = createRouteMatcher(["/dashboard(.*)", "/setup(.*)", "/onboarding(.*)", "/api/stripe/connect(.*)", "/api/billing(.*)"]);

const withClerk = clerkMiddleware(async (auth, req) => {
  if (isProtected(req)) await auth.protect();
  return NextResponse.next();
});

export default function proxy(req: NextRequest, event: NextFetchEvent) {
  const slug = tenantSlugFromHost(req.headers.get("host"), ROOT_DOMAIN);

  if (slug) {
    const url = req.nextUrl.clone();
    const p = url.pathname;
    // Already-internal paths pass through; everything else is the tenant's site.
    if (!p.startsWith("/s/") && !p.startsWith("/api/") && !p.startsWith("/_next")) {
      url.pathname = `/s/${slug}${p === "/" ? "" : p}`;
      // Request headers (not response headers) are what server components read.
      const headers = new Headers(req.headers);
      headers.set("x-tenant-slug", slug);
      headers.set("x-tenant-host", "1");
      return NextResponse.rewrite(url, { request: { headers } });
    }
    return NextResponse.next();
  }

  if (usesClerk(req)) return withClerk(req, event);
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip Next internals and static assets unless referenced in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
