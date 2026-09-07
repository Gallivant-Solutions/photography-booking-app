# Bookedin

One link. Questionnaire, contract, deposit — done.

A multi-tenant client-intake product for photographers. A client opens
`marin.bookedin.co`, answers four questions, signs a generated agreement by
typing their name, and pays the deposit with a card field embedded on that
page. The photographer sees a bookings list where every row carries its money.

Built from the *Client Intake – Hi-Fi* design (Organic design system).

## Stack

| Layer | Choice | Notes |
| --- | --- | --- |
| Framework | Next.js 16 (App Router, `src/proxy.ts`) | Server components + server actions; route handlers for webhooks/APIs |
| Styling | Tailwind 4 + the design system's class layer | Tokens in `src/app/globals.css` (`@theme`); Caprasimo + Figtree via `next/font` |
| Auth | Clerk | Photographers only. Clients never sign in — a per-booking httpOnly cookie identifies them |
| Database | Postgres + Drizzle | **Row-level security on every tenant table**, enforced by a non-owner DB role |
| Payments | Stripe Connect (deposits) + Stripe Billing (Solo/Studio) | Direct charges on the photographer's own account; the platform never holds funds |
| Hosting | Vercel | Wildcard subdomain → tenant rewrite in the proxy |
| Icons | lucide-react | stroke 2.75 per the design system |

## Multi-tenancy & RLS

Every tenant-owned table has `tenant_id`, `ENABLE ROW LEVEL SECURITY`, and a
policy comparing it to the transaction-local setting `app.tenant_id`
(`src/db/schema.ts`). Application code reaches those tables only through
`withTenant(tenantId, tx => …)` (`src/db/client.ts`), which runs
`set_config('app.tenant_id', …, true)` inside a transaction — the value can't
leak across pooled connections.

Two DB connections, two trust levels:

- `DATABASE_URL` — the **app role** (`bookedin_app`, created by migration
  `0001_app_role.sql`). Not the table owner, `NOBYPASSRLS`. Policies are a hard
  guard for it.
- `DATABASE_ADMIN_URL` — the **owner role**. Used only for migrations and the
  handful of named cross-tenant lookups in `src/db/system.ts` (tenant by slug,
  memberships for a Clerk user, tenant creation, webhook idempotency log).

`npm run db:rls-check` proves the setup against the real database: it verifies
the app role isn't a superuser/owner/bypassrls, then confirms tenant A can't
read or write tenant B's rows and sees nothing with no tenant set.

Tenant routing: `{slug}.{NEXT_PUBLIC_ROOT_DOMAIN}/…` is rewritten by
`src/proxy.ts` to `/s/{slug}/…`. The root domain serves marketing and the
photographer dashboard. Custom domains: `tenants.custom_domain` +
`findTenantByCustomDomain()` exist; wiring the host lookup into the proxy is a
follow-up (needs an edge-readable cache such as Vercel Edge Config).

## Project layout

```
src/
  proxy.ts                  Clerk middleware + tenant subdomain rewrite
  env.ts                    zod-validated env (server lazily, public eagerly)
  app/
    (marketing)/            landing, pricing
    (app)/                  Clerk-protected: sign-in/up, onboarding, dashboard, setup
    s/[slug]/               client flow: welcome → q/1..n → sign → deposit → done
    api/                    health, tenants/slug, bookings/:id/payment-intent,
                            stripe/connect, billing/checkout, webhooks/{stripe,stripe/connect,clerk}
  components/ui             Button, Tag, Field/Input, ChoiceCard/ChipRadio/Seg, Panel, Stat…
  components/{intake,dashboard,setup,marketing}
  db/                       schema (tables + RLS policies), client (withTenant), system, migrations, seed
  server/                   services: tenant, intake, bookings, ledger, contracts, clauses, setup, stripe
  server/actions/           server actions used by forms
scripts/rls-check.ts        RLS enforcement test
```

## Domain model (short version)

- `tenants` ← `memberships` (Clerk user ↔ tenant; one owner in v1, table allows more)
- `intake_forms` (welcome copy, shoot types, deposit rule) ← `questions`, `packages`, `contract_clauses`
- `bookings` — the client's answers, snapshotted package/deposit, e-sign fields, frozen `contract_snapshot`
- `ledger_entries` — charges, refunds, payouts. **Money is summed from here, never typed.**
  `booking.status` becomes `confirmed` only from the Stripe webhook.
- `subscriptions` — platform billing; `stripe_events` — webhook idempotency (system role only)

Contracts are assembled from a **clause library** (`src/server/clauses.ts`):
six clauses, each with 2–4 vetted variants and fill-in-the-blank params. A
photographer can write their own wording; it's flagged on the contract.

## Local setup

```bash
cp .env.example .env.local        # fill in Clerk + Stripe test keys, Postgres URLs
npm install
npm run db:migrate                # as the owner role; also creates bookedin_app
# set a real password: psql … -c "ALTER ROLE bookedin_app PASSWORD '…'"; put it in DATABASE_URL
npm run db:rls-check              # must print "All RLS checks passed."
npm run db:seed -- --user user_xxx   # demo studio "Marin & Co" owned by your Clerk user id
npm run dev
```

Then:

- http://localhost:3000 — landing → Start free → Clerk sign-up → `/onboarding`
- http://localhost:3000/dashboard — bookings (seeded), `/setup/*` — the four setup steps
- http://marin.localhost:3000 — the client link (Chrome resolves `*.localhost`)
- http://localhost:3000/s/marin — same thing, root-domain preview

Stripe locally: `stripe listen --forward-to localhost:3000/api/webhooks/stripe`
and a second listener with `--forward-connect-to localhost:3000/api/webhooks/stripe/connect`.
Put each `whsec_` in the matching env var.

## Deploying to Vercel

1. Add the project; set every variable from `.env.example` (`NEXT_PUBLIC_ROOT_DOMAIN=bookedin.co`).
2. Domains: `bookedin.co`, `www.bookedin.co`, and the wildcard `*.bookedin.co`.
3. Postgres: Neon or Supabase. Run `npm run db:migrate` against it once, then
   `db:rls-check` with the production URLs.
4. Stripe: create the two webhook endpoints (platform and Connect) and the four
   prices; enable Connect with the “full dashboard” account type.
5. Clerk: production instance keys; add `/api/webhooks/clerk` if you want `user.deleted`.

## What's here vs. what's next

Done: every surface in the design (client flow, dashboard, booking ledger,
refund, setup 1–4, clause editor, landing, pricing), the schema with RLS, tenant
routing, Clerk auth, Connect onboarding, embedded deposit, refunds, webhooks,
billing checkout, seed data, RLS test.

Not yet (flagged in code with `TODO` or disabled buttons):

- Emails (signed PDF + receipt to both parties) — hook in `payment_intent.succeeded`
- PDF rendering — the frozen text snapshot is shown/printable at `/b/:id/agreement`
- Charge balance / request payment / reminders (Studio)
- Custom domains in the proxy; extra clauses (travel, overtime, model release)
- Tests beyond `db:rls-check`
