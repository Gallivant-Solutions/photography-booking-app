import type { Metadata } from "next";
import Link from "next/link";
import { AppShell } from "@/components/dashboard/app-shell";
import { CopyLinkButton } from "@/components/dashboard/copy-link-button";
import { Avatar, EmptyState, Panel, Stat } from "@/components/ui/bits";
import { Button } from "@/components/ui/button";
import { Tag } from "@/components/ui/tag";
import { withTenant } from "@/db/client";
import { publicEnv } from "@/env";
import { formatDate, formatMoney, timeAgo } from "@/lib/money";
import { tenantHostLabel, tenantUrl } from "@/lib/tenant-host";
import { dashboardStats, listBookings, type BookingFilter } from "@/server/bookings";
import { statusPresentation } from "@/server/ledger";
import { requireStudio } from "@/server/tenant";

export const metadata: Metadata = { title: "Bookings" };

const FILTERS: Array<{ key: BookingFilter; label: string }> = [
  { key: "all", label: "All bookings" },
  { key: "needs_you", label: "Needs you" },
  { key: "balance", label: "Balance owing" },
  { key: "unfinished", label: "Unfinished" },
];

export default async function DashboardPage({ searchParams }: PageProps<"/dashboard">) {
  const studio = await requireStudio();
  const sp = await searchParams;
  const filter = (FILTERS.some((f) => f.key === sp.filter) ? sp.filter : "all") as BookingFilter;
  const root = publicEnv.NEXT_PUBLIC_ROOT_DOMAIN;

  const { rows, stats } = await withTenant(studio.tenant.id, async (tx) => ({
    rows: await listBookings(tx, studio.tenant.id, filter),
    stats: await dashboardStats(tx, studio.tenant.id),
  }));

  return (
    <AppShell tenant={studio.tenant} active="bookings">
      <Panel>
        <div className="flex flex-wrap items-center gap-3 border-b border-divider px-5 py-5 sm:gap-4 sm:px-[30px]">
          <Avatar name={studio.tenant.name} />
          <h1 className="font-heading text-[22px] text-text">Bookings</h1>
          <Tag tone="neutral" className="hidden sm:inline-flex">{tenantHostLabel(studio.tenant.slug, root)}</Tag>
          <div className="flex-1" />
          <CopyLinkButton url={tenantUrl(studio.tenant.slug, root)} />
          <Button href="/setup/questions">Edit form</Button>
        </div>

        <div className="grid grid-cols-2 gap-px bg-divider lg:grid-cols-4">
          <Stat label="Needs you" value={stats.needsYou} tone={stats.needsYou > 0 ? "accent" : undefined} />
          <Stat label="Confirmed" value={stats.confirmed} />
          <Stat label="Collected this month" value={formatMoney(stats.collectedThisMonthCents)} />
          <Stat
            label="Last payout"
            value={stats.lastPayout ? formatDate(stats.lastPayout.occurredAt) : "—"}
            sub={stats.lastPayout ? `${formatMoney(stats.lastPayout.netCents, { cents: true })}${stats.lastPayout.methodLabel ? ` · ${stats.lastPayout.methodLabel}` : ""}` : "No payouts yet"}
          />
        </div>

        <div className="flex flex-wrap gap-2 border-t border-divider px-5 pb-3.5 pt-4 sm:px-[30px]">
          {FILTERS.map((f) => (
            <Link key={f.key} href={f.key === "all" ? "/dashboard" : `/dashboard?filter=${f.key}`} className="chip chip-sm" aria-current={filter === f.key ? "true" : undefined}>
              {f.label}
            </Link>
          ))}
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title={filter === "all" ? "No bookings yet" : "Nothing here"}
            body={
              filter === "all"
                ? studio.tenant.publishedAt
                  ? "Send your link to the next enquiry. Bookings appear here the moment someone starts."
                  : "Your link isn't live yet. Finish setup and publish it, then send it to your next enquiry."
                : "Nothing matches this filter right now."
            }
            action={!studio.tenant.publishedAt ? <Button href="/setup/link">Finish setup</Button> : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[760px]">
              <thead>
                <tr>
                  <th className="pl-5 sm:pl-[30px]">Client</th>
                  <th>Shoot</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th className="num">Collected</th>
                  <th className="num pr-5 sm:pr-[30px]">Balance</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => {
                  const st = statusPresentation(b.status, b);
                  const dim = b.status === "cancelled" || b.status === "refunded";
                  const sub =
                    b.status === "in_progress"
                      ? `Stopped at question ${Math.max(1, b.currentStep)} · ${timeAgo(b.lastActivityAt)}`
                      : b.status === "awaiting_deposit" || b.status === "payment_failed"
                        ? `Signed ${timeAgo(b.signedAt)}`
                        : b.cancelledAt
                          ? `Cancelled ${formatDate(b.cancelledAt)}`
                          : (b.location ?? b.clientEmail ?? "");
                  return (
                    <tr key={b.id} className="relative">
                      <td className="pl-5 sm:pl-[30px]">
                        <Link href={`/dashboard/bookings/${b.id}`} className={`block text-[15.5px] font-semibold ${dim ? "text-neutral-700" : "text-text"} after:absolute after:inset-0 after:content-['']`}>
                          {b.clientName ?? "Unnamed"}
                        </Link>
                        <div className="text-[12.5px] text-neutral-700">{sub}</div>
                      </td>
                      <td>{b.packageName ?? b.shootType ?? "—"}</td>
                      <td>{b.eventDate ? formatDate(b.eventDate) : "—"}</td>
                      <td>
                        <Tag tone={st.tone}>{st.label}{b.status === "in_progress" ? ` · ${timeAgo(b.lastActivityAt).replace(" ago", "")}` : ""}</Tag>
                      </td>
                      <td className="num">{b.money.collectedCents > 0 ? formatMoney(b.money.collectedCents - b.money.refundedCents) : "—"}</td>
                      <td className="money pr-5 sm:pr-[30px]">{b.packagePriceCents && !dim ? formatMoney(b.money.balanceCents) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </AppShell>
  );
}
