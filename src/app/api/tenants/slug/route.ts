import { isSlugAvailable } from "@/db/system";
import { isValidSlug } from "@/lib/tenant-host";
import { handler, ok } from "@/server/api";

export const dynamic = "force-dynamic";

/** GET /api/tenants/slug?slug=marin → { available, valid } */
export const GET = handler(async (req) => {
  const slug = new URL(req.url).searchParams.get("slug")?.trim().toLowerCase() ?? "";
  const valid = isValidSlug(slug);
  const available = valid ? await isSlugAvailable(slug) : false;
  return ok({ slug, valid, available });
});
