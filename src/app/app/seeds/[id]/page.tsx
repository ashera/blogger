import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";

// Resolver: send the user to the seed's current wizard step. Refresh/bookmark
// "just works" because the URL is the wizard state. "done" lands on generate.
export default async function SeedResolverPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/app/seeds");

  const r = await query<{ wizard_step: string }>(
    `SELECT wizard_step FROM blog_seeds
      WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
    [id, me.id],
  );
  const step = r.rows[0]?.wizard_step;
  if (!step) redirect("/app/seeds");

  redirect(`/app/seeds/${id}/${step === "done" ? "generate" : step}`);
}
