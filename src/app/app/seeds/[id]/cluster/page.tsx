import { notFound, redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  addSeedKeyword,
  advanceWizardStep,
  expandSeedKeywords,
  removeSeedKeyword,
} from "@/lib/actions/blog-builder";
import { Field, Input } from "../../../../_components/ui";
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

type KeywordRow = {
  id: string;
  phrase: string;
  intent: string | null;
  is_primary: boolean;
  is_starter: boolean;
};

export default async function ClusterReviewPage({
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

  const [seedRes, clusterRes, keywordsRes] = await Promise.all([
    query<SeedRow>(
      `SELECT id::text, title, wizard_step, starter_keywords
         FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [id, me.id],
    ),
    query<{ name: string; intent: string | null }>(
      `SELECT name, intent FROM blog_clusters WHERE seed_id = $1::bigint LIMIT 1`,
      [id],
    ),
    query<KeywordRow>(
      `SELECT id::text, phrase, intent, is_primary, is_starter
         FROM blog_keywords WHERE seed_id = $1::bigint
        ORDER BY is_primary DESC, is_starter DESC, phrase`,
      [id],
    ),
  ]);
  const seed = seedRes.rows[0];
  if (!seed) notFound();
  const cluster = clusterRes.rows[0] ?? null;
  // No cluster yet — send the user back to enter starter keywords first.
  if (!cluster) redirect(`/app/seeds/${seed.id}/keywords`);
  const keywords = keywordsRes.rows;

  return (
    <WizardShell
      seedId={seed.id}
      title={seed.title}
      current="cluster"
      reached={seed.wizard_step}
    >
      <WizardNotice saved={Boolean(saved)} errorMessage={errorMessage} />

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <h2 className="card-heading">Review the cluster ({keywords.length})</h2>
        <p className="card-sub">
          {cluster!.intent ?? "no intent"} · the primary keyword anchors the
          set. Drop any that don&rsquo;t fit or add your own, then accept to move
          on — or regenerate for a different set.
        </p>

        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: "var(--s-4) 0",
            display: "flex",
            flexDirection: "column",
            gap: 6,
          }}
        >
          {keywords.map((k) => (
            <li
              key={k.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto auto",
                gap: "var(--s-3)",
                alignItems: "center",
                padding: "8px 12px",
                background: k.is_primary ? "var(--surface-sunken)" : "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
              }}
            >
              <div style={{ minWidth: 0, fontWeight: k.is_primary ? 700 : 600 }}>
                {k.phrase}
                {k.is_primary && (
                  <span className="users-tag --admin" style={{ marginLeft: 8 }}>
                    Primary
                  </span>
                )}
                {!k.is_primary && k.is_starter && (
                  <span className="users-tag" style={{ marginLeft: 8 }}>
                    Starter
                  </span>
                )}
              </div>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  color: "var(--ink-3)",
                  textTransform: "uppercase",
                }}
              >
                {k.intent ?? "—"}
              </span>
              {k.is_primary ? (
                <span style={{ width: 70 }} />
              ) : (
                <form action={removeSeedKeyword}>
                  <input type="hidden" name="seedId" value={seed.id} />
                  <input type="hidden" name="keywordId" value={k.id} />
                  <button
                    type="submit"
                    title="Remove from cluster"
                    style={{
                      background: "transparent",
                      border: "1px solid var(--hairline)",
                      color: "var(--ink-3)",
                      padding: "4px 10px",
                      borderRadius: 999,
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    Remove
                  </button>
                </form>
              )}
            </li>
          ))}
        </ul>

        <form
          action={addSeedKeyword}
          style={{
            display: "flex",
            gap: "var(--s-2)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <input type="hidden" name="seedId" value={seed.id} />
          <Field label="Add a keyword" htmlFor="add-phrase">
            <Input
              id="add-phrase"
              name="phrase"
              minLength={2}
              maxLength={200}
              placeholder="another related phrase"
              style={{ minWidth: 280 }}
            />
          </Field>
          <SubmitButton variant="dark" pendingLabel="Adding…">
            + Add
          </SubmitButton>
        </form>
      </section>

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <h2 className="card-heading">Not quite right?</h2>
        <p className="card-sub">
          Regenerate runs the AI expansion again on your starter keywords for a
          fresh set (this replaces the current keywords). Or edit the starters
          first.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={expandSeedKeywords}>
            <input type="hidden" name="seedId" value={seed.id} />
            <input
              type="hidden"
              name="starters"
              value={seed.starter_keywords ?? ""}
            />
            <SubmitButton variant="ghost" pendingLabel="Regenerating… (5–15s)">
              Regenerate cluster
            </SubmitButton>
          </form>
          <a href={`/app/seeds/${seed.id}/keywords`} className="btn --ghost">
            Edit starter keywords
          </a>
        </div>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
          paddingTop: "var(--s-3)",
        }}
      >
        <a href={`/app/seeds/${seed.id}/keywords`} className="btn --ghost">
          ← Back: Keywords
        </a>
        <form action={advanceWizardStep}>
          <input type="hidden" name="seedId" value={seed.id} />
          <input type="hidden" name="step" value="serp" />
          <SubmitButton variant="primary" pendingLabel="Continuing…">
            Accept &amp; continue to SERP →
          </SubmitButton>
        </form>
      </div>
    </WizardShell>
  );
}
