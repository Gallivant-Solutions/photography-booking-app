import Link from "next/link";
import { UserButton } from "@clerk/nextjs";
import type { ReactNode } from "react";
import { Avatar } from "@/components/ui/bits";
import type { Tenant } from "@/db/schema";
import { publicEnv } from "@/env";
import { tenantHostLabel, tenantUrl } from "@/lib/tenant-host";

/** Frame for every photographer-side page: brand, nav, account. */
export function AppShell({ tenant, active, children }: { tenant: Tenant; active: "bookings" | "setup"; children: ReactNode }) {
  const root = publicEnv.NEXT_PUBLIC_ROOT_DOMAIN;
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      <header className="mb-4 flex items-center gap-3 px-2 sm:mb-5 sm:gap-4">
        <Link href="/dashboard" className="flex items-center gap-3 text-text hover:text-text">
          <Avatar name={tenant.name} size={34} />
          <span className="hidden text-[15px] font-semibold sm:inline">{tenant.name}</span>
        </Link>
        <nav className="ml-2 flex items-center gap-1 text-[14px] sm:ml-4">
          <NavLink href="/dashboard" active={active === "bookings"}>Bookings</NavLink>
          <NavLink href="/setup/questions" active={active === "setup"}>Setup</NavLink>
        </nav>
        <div className="flex-1" />
        <a
          href={tenantUrl(tenant.slug, root)}
          target="_blank"
          rel="noreferrer"
          className="tag tag-neutral hidden text-[12.5px] hover:bg-neutral-300 sm:inline-flex"
          title="Open your client link"
        >
          {tenantHostLabel(tenant.slug, root)}
          {!tenant.publishedAt ? <span className="text-neutral-600">· draft</span> : null}
        </a>
        <UserButton />
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}

function NavLink({ href, active, children }: { href: string; active: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "rounded-full bg-accent-700 px-4 py-2 font-semibold text-bg hover:text-bg"
          : "rounded-full px-4 py-2 text-neutral-800 hover:bg-neutral-300/60 hover:text-text"
      }
    >
      {children}
    </Link>
  );
}
