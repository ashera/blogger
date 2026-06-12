import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { expandSeedKeywords, renameSeed } from "@/lib/actions/blog-builder";
import { Button, Field, Input, Textarea } from "../../../../_components/ui";
import { SubmitButton } from "../../../../_components/submit-button";
import {
  WizardShell,
  WizardNotice,
  WIZARD_ERRORS,
} from "../../../../_components/wizard-steps";

export const dynamic = "force-dynamic";

type SeedRow = {
  id: string;
  title: string;
  wizard_step: string;
  starter_keywords: string | null;
};

export default async function KeywordsStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const { saved, error } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const errorMessage = error
    ? WIZARD_ERRORS[error] ?? "Something went wrong."
    : null;

  const [seedRes, clusterRes] = await Promise.all([
    query<SeedRow>(
      `SELECT id::text, title, wizard_step, starter_keywords
         FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [id, me.id],
    ),
    query<{ one: number }>(
      `SELECT 1 AS one FROM blog_clusters WHERE seed_id = $1::bigint LIMIT 1`,
      [id],
    ),
  ]);
  const seed = seedRes.rows[0];
  if (!seed) notFound();
  const hasCluster = clusterRes.rows.length > 0;

  return (
    <WizardShell
      seedId={seed.id}
      title={seed.title}
      current="keywords"
      reached={seed.wizard_step}
    >
      <WizardNotice saved={Boolean(saved)} errorMessage={errorMessage} />

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <h2 className="card-heading">Seed subject</h2>
        <p className="card-sub">The friendly name for this seed.</p>
        <form
          action={renameSeed}
          style={{
            display: "flex",
            gap: "var(--s-3)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <input type="hidden" name="seedId" value={seed.id} />
          <Field label="Title" htmlFor="title">
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              defaultValue={seed.title}
              style={{ minWidth: 320 }}
            />
          </Field>
          <Button type="submit" variant="dark">
            Save title
          </Button>
        </form>
      </section>

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <h2 className="card-heading">Starter keywords</h2>
        <p className="card-sub">
          Type a few starter keywords (one per line, or comma-separated) and
          our AI expands them into a tight cluster of 8–14 related search
          phrases that share one intent. The first starter becomes the primary
          keyword. You&rsquo;ll review the generated set on the next step before
          moving on.
        </p>
        <form action={expandSeedKeywords}>
          <input type="hidden" name="seedId" value={seed.id} />
          <Field label="Starter keywords" htmlFor="starters">
            <Textarea
              id="starters"
              name="starters"
              required
              rows={4}
              defaultValue={seed.starter_keywords ?? ""}
              placeholder={"electric bikes for commuting\nbest commuter ebike\nebike range"}
            />
          </Field>
          <div style={{ marginTop: "var(--s-3)" }}>
            <SubmitButton variant="primary" pendingLabel="Expanding… (5–15s)">
              {hasCluster ? "Re-expand into a cluster →" : "Expand into a cluster →"}
            </SubmitButton>
          </div>
        </form>
      </section>

      {hasCluster && (
        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <h2 className="card-heading">Cluster ready</h2>
          <p className="card-sub">
            You&rsquo;ve already generated a keyword cluster for this seed.
            Review it, or re-expand above to start over.
          </p>
          <a href={`/app/seeds/${seed.id}/cluster`} className="btn --primary">
            Review the cluster →
          </a>
        </section>
      )}
    </WizardShell>
  );
}
