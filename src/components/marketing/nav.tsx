import Link from "next/link";
import { Button } from "@/components/ui/button";

export function MarketingNav() {
  return (
    <header className="flex items-center gap-4 px-5 py-5 sm:px-12">
      <Link href="/" className="flex items-center gap-3 text-text hover:text-text">
        <span className="inline-flex size-[34px] items-center justify-center rounded-full bg-accent-700 font-heading text-[15px] text-bg">b</span>
        <span className="font-heading text-[20px]">Bookedin</span>
      </Link>
      <div className="flex-1" />
      <nav className="hidden items-center gap-6 text-[14.5px] sm:flex">
        <Link href="/#how" className="text-neutral-800 hover:text-accent-700">How it works</Link>
        <Link href="/pricing" className="text-neutral-800 hover:text-accent-700">Pricing</Link>
        <Link href="/sign-in" className="text-neutral-800 hover:text-accent-700">Sign in</Link>
      </nav>
      <Button href="/sign-up" size="sm" className="sm:btn-md">Start free</Button>
    </header>
  );
}
