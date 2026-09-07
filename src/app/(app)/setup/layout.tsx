import { AppShell } from "@/components/dashboard/app-shell";
import { SetupSidebar } from "@/components/setup/setup-sidebar";
import { withTenant } from "@/db/client";
import { loadDefaultForm } from "@/server/intake";
import { requireStudio } from "@/server/tenant";

export default async function SetupLayout({ children }: LayoutProps<"/setup">) {
  const studio = await requireStudio();
  const bundle = await withTenant(studio.tenant.id, (tx) => loadDefaultForm(tx, studio.tenant.id));

  const done = {
    questions: (bundle?.questions.length ?? 0) > 0 && (bundle?.packages.filter((p) => p.active).length ?? 0) > 0,
    contract: (bundle?.clauses.filter((c) => !c.omitted).length ?? 0) >= 4,
    deposit: studio.tenant.stripeChargesEnabled,
    link: Boolean(studio.tenant.publishedAt),
  };

  return (
    <AppShell tenant={studio.tenant} active="setup">
      <div className="panel flex flex-col overflow-hidden lg:flex-row">
        <SetupSidebar tenant={studio.tenant} done={done} questionCount={bundle?.questions.length ?? 0} />
        <div className="flex flex-1 flex-col gap-5 p-5 sm:p-8">{children}</div>
      </div>
    </AppShell>
  );
}
