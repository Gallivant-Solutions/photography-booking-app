import Link from "next/link";
import { MarketingNav } from "@/components/marketing/nav";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto flex w-full max-w-[1100px] flex-1 flex-col px-3 py-4 sm:px-6 sm:py-6">
      <div className="panel flex flex-1 flex-col">
        <MarketingNav />
        <main className="flex-1">{children}</main>
        <footer className="flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-divider px-5 py-6 text-[13px] text-neutral-700 sm:px-12">
          <span>© {new Date().getFullYear()} Bookedin</span>
          <Link href="/pricing">Pricing</Link>
          <Link href="/sign-in">Sign in</Link>
          <span className="ml-auto">Questions? Reply to any email — a person answers.</span>
        </footer>
      </div>
    </div>
  );
}
