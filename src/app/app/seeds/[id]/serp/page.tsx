import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { clearSerpAnalysis, runSerpAnalysis } from "@/lib/actions/blog-builder";
import { Button } from "../../../../_components/ui";
import { SubmitButton } from "../../../../_components/submit-button";
import {
  WizardShell,
  WizardNotice,
  WIZARD_ERRORS,
} from "../../../../_components/wizard-steps";

export const dynamic = "force-dynamic";

type SerpAnalysis = {
  keyword?: string;
  summary?: string;
  top_results?: Array<{
    rank?: number;
    url?: string;
    title?: string;
    domain?: string;
    format?: string;
    estimated_word_count?: number;
    topics_covered?: string[];
  }>;
  average_word_count?: number;
  target_word_count?: string;
  common_topics?: string[];
  missing_topics_to_add?: string[];
  recommended_format?: string;
  format_rationale?: string;
};

type SeedRow = {
  id: string;
  title: string;
  wizard_step: string;
  serp_analysis_json: SerpAnalysis | null;
  serp_analyzed_at: string | null;
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return s;
  }
}

const mono = {
  fontFamily: "var(--font-mono)",
  fontSize: 11,
  textTransform: "uppercase" as const,
  letterSpacing: "0.06em",
  color: "var(--ink-3)",
};

export default async function SerpStepPage({
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

  const [seedRes, primaryRes] = await Promise.all([
    query<SeedRow>(
      `SELECT id::text, title, wizard_step, serp_analysis_json,
              serp_analyzed_at::text
         FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [id, me.id],
    ),
    query<{ phrase: string }>(
      `SELECT phrase FROM blog_keywords
        WHERE seed_id = $1::bigint AND is_primary = TRUE LIMIT 1`,
      [id],
    ),
  ]);
  const seed = seedRes.rows[0];
  if (!seed) notFound();
  const serp = seed.serp_analysis_json;
  const primaryPhrase = primaryRes.rows[0]?.phrase ?? seed.title;

  return (
    <WizardShell
      seedId={seed.id}
      title={seed.title}
      current="serp"
      reached={seed.wizard_step}
    >
      <WizardNotice saved={Boolean(saved)} errorMessage={errorMessage} />

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: "var(--s-3)",
          }}
        >
          <div>
            <h2 className="card-heading" style={{ margin: 0 }}>
              SERP analysis
            </h2>
            <p className="card-sub" style={{ marginTop: 4 }}>
              Search Google for the primary keyword (“{primaryPhrase}”), fetch
              the top 3 organic results, and analyze their format, length, and
              topics.
              {seed.serp_analyzed_at
                ? ` Last run ${formatDate(seed.serp_analyzed_at)}.`
                : " Not run yet."}
            </p>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <form action={runSerpAnalysis}>
              <input type="hidden" name="seedId" value={seed.id} />
              <SubmitButton
                variant={serp ? "ghost" : "primary"}
                pendingLabel="Running…"
                waitModal={{
                  title: "Researching the live SERP…",
                  subtext:
                    "Reading the top-ranking pages for your keyword — this can take 20–60 seconds.",
                }}
              >
                {serp ? "Re-run analysis" : "Run analysis"}
              </SubmitButton>
            </form>
            {serp && (
              <form action={clearSerpAnalysis}>
                <input type="hidden" name="seedId" value={seed.id} />
                <Button type="submit" variant="ghost">
                  Clear
                </Button>
              </form>
            )}
          </div>
        </div>

        {serp ? (
          <div
            style={{
              padding: "var(--s-4)",
              background: "var(--surface-sunken)",
              borderRadius: 10,
              border: "1px solid var(--hairline)",
              fontSize: "var(--t-body-s)",
            }}
          >
            {serp.summary && (
              <p style={{ margin: "0 0 var(--s-3)", color: "var(--ink-2)" }}>
                {serp.summary}
              </p>
            )}

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                gap: "var(--s-3)",
                marginBottom: "var(--s-4)",
              }}
            >
              <div>
                <div style={mono}>Recommended format</div>
                <div
                  style={{
                    fontWeight: 700,
                    color: "var(--ink-1)",
                    textTransform: "capitalize",
                  }}
                >
                  {serp.recommended_format ?? "—"}
                </div>
              </div>
              <div>
                <div style={mono}>Target length</div>
                <div style={{ fontWeight: 700, color: "var(--ink-1)" }}>
                  {serp.target_word_count ??
                    (serp.average_word_count
                      ? `~${serp.average_word_count} words`
                      : "—")}
                </div>
              </div>
            </div>

            {serp.format_rationale && (
              <p
                style={{
                  margin: "0 0 var(--s-4)",
                  color: "var(--ink-3)",
                  fontStyle: "italic",
                }}
              >
                {serp.format_rationale}
              </p>
            )}

            {Array.isArray(serp.top_results) && serp.top_results.length > 0 && (
              <div style={{ marginBottom: "var(--s-4)" }}>
                <div style={{ ...mono, marginBottom: 6 }}>Top 3 ranking pages</div>
                <ol
                  style={{
                    margin: 0,
                    paddingLeft: 24,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  {serp.top_results.map((r) => (
                    <li key={r.url ?? r.rank} style={{ minWidth: 0 }}>
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener"
                        style={{
                          color: "var(--ink-1)",
                          fontWeight: 600,
                          textDecoration: "none",
                        }}
                      >
                        {r.title ?? r.url}
                      </a>{" "}
                      <span style={{ color: "var(--ink-3)" }}>
                        ({r.domain ?? "—"})
                      </span>
                      <div style={{ fontSize: 12, color: "var(--ink-3)" }}>
                        {r.format ?? "—"} ·{" "}
                        {r.estimated_word_count
                          ? `~${r.estimated_word_count} words`
                          : "length unknown"}
                      </div>
                      {r.topics_covered && r.topics_covered.length > 0 && (
                        <div
                          style={{
                            fontSize: 12,
                            color: "var(--ink-3)",
                            marginTop: 2,
                          }}
                        >
                          {r.topics_covered.slice(0, 8).join(" · ")}
                        </div>
                      )}
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {Array.isArray(serp.common_topics) &&
              serp.common_topics.length > 0 && (
                <div style={{ marginBottom: "var(--s-3)" }}>
                  <div style={{ ...mono, marginBottom: 6 }}>
                    Topics every top-3 page covers
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {serp.common_topics.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "3px 10px",
                          background: "var(--surface)",
                          border: "1px solid var(--hairline)",
                          borderRadius: 999,
                          fontSize: 12,
                          color: "var(--ink-2)",
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            {Array.isArray(serp.missing_topics_to_add) &&
              serp.missing_topics_to_add.length > 0 && (
                <div>
                  <div style={{ ...mono, marginBottom: 6 }}>
                    Topics to add (the gap)
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {serp.missing_topics_to_add.map((t, i) => (
                      <span
                        key={i}
                        style={{
                          padding: "3px 10px",
                          background: "var(--volt-100)",
                          border: "1px solid var(--volt-300)",
                          color: "var(--ink-1)",
                          borderRadius: 999,
                          fontSize: 12,
                          fontWeight: 600,
                        }}
                      >
                        + {t}
                      </span>
                    ))}
                  </div>
                </div>
              )}
          </div>
        ) : (
          <p
            style={{
              color: "var(--ink-3)",
              margin: 0,
              fontSize: "var(--t-body-s)",
            }}
          >
            Run the analysis to see SERP format, target length, and the topics
            worth covering.
          </p>
        )}
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <a href={`/app/seeds/${seed.id}/cluster`} className="btn --ghost">
          ← Back: Keywords
        </a>
        {serp && (
          <a href={`/app/seeds/${seed.id}/images`} className="btn --primary">
            Next: Images →
          </a>
        )}
      </div>
    </WizardShell>
  );
}
