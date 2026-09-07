import { currentUser } from "@clerk/nextjs/server";
import { handler, ok, unauthorized } from "@/server/api";
import { updateTenantProfile } from "@/server/setup";
import { createAccountOnboardingLink, createConnectAccount, fetchAccountStatus } from "@/server/stripe";
import { getStudio, withStudio } from "@/server/tenant";

export const dynamic = "force-dynamic";

/** POST /api/stripe/connect → { url } — start or resume Connect onboarding. */
export const POST = handler(async () => {
  const studio = await getStudio();
  if (!studio) throw unauthorized();
  const user = await currentUser();
  let accountId = studio.tenant.stripeAccountId;
  if (!accountId) {
    accountId = await createConnectAccount(studio.tenant, user?.primaryEmailAddress?.emailAddress ?? null);
    await withStudio((tx, s) => updateTenantProfile(tx, s.tenant.id, { stripeAccountId: accountId }));
  }
  return ok({ url: await createAccountOnboardingLink(accountId) });
});

/** GET /api/stripe/connect → current Connect status (refreshes from Stripe). */
export const GET = handler(async () => {
  const studio = await getStudio();
  if (!studio) throw unauthorized();
  if (!studio.tenant.stripeAccountId) return ok({ connected: false });
  const status = await fetchAccountStatus(studio.tenant.stripeAccountId);
  await withStudio((tx, s) =>
    updateTenantProfile(tx, s.tenant.id, {
      stripeChargesEnabled: status.chargesEnabled,
      stripePayoutsEnabled: status.payoutsEnabled,
    }),
  );
  return ok({ connected: true, ...status });
});
