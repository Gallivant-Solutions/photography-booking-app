import type { Metadata } from "next";
import { requireTenantBySlug } from "@/server/tenant";

export async function generateMetadata({ params }: LayoutProps<"/s/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tenant = await requireTenantBySlug(slug);
  return {
    title: { default: `Book ${tenant.name}`, template: `%s · ${tenant.name}` },
    description: tenant.tagline ?? `Book a shoot with ${tenant.name}`,
    robots: { index: false },
  };
}

export default async function TenantLayout({ children, params }: LayoutProps<"/s/[slug]">) {
  const { slug } = await params;
  await requireTenantBySlug(slug); // 404 for unknown studios before any child renders
  return <>{children}</>;
}
