import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { withTenant, type TenantTx } from "@/db/client";
import { findMembershipsForUser, findTenantBySlug } from "@/db/system";
import type { Membership, Tenant } from "@/db/schema";

/** Public (client-link) side: tenant from the URL slug the proxy rewrote in. */
export const requireTenantBySlug = cache(async (slug: string): Promise<Tenant> => {
  const tenant = await findTenantBySlug(slug);
  if (!tenant) notFound();
  return tenant;
});

export type Studio = { tenant: Tenant; membership: Membership; userId: string };

/**
 * Photographer side: the signed-in Clerk user's studio. One studio per user in
 * v1; the memberships table already allows more, so a tenant switcher is a UI
 * change, not a data-model change.
 */
export const getStudio = cache(async (): Promise<Studio | null> => {
  const { userId } = await auth();
  if (!userId) return null;
  const rows = await findMembershipsForUser(userId);
  const first = rows[0];
  if (!first) return null;
  return { tenant: first.tenant, membership: first.membership, userId };
});

/** Redirects to sign-in or onboarding as needed; returns a studio otherwise. */
export async function requireStudio(): Promise<Studio> {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();
  const studio = await getStudio();
  if (!studio) redirect("/onboarding");
  return studio;
}

/** Convenience: run a tenant-scoped transaction for the current studio. */
export async function withStudio<T>(fn: (tx: TenantTx, studio: Studio) => Promise<T>): Promise<T> {
  const studio = await requireStudio();
  return withTenant(studio.tenant.id, (tx) => fn(tx, studio));
}
