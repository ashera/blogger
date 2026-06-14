import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createSeed, deleteSeed } from "@/lib/actions/blog-builder";
import { Button, Field, Input } from "../../_components/ui";
import { SubmitButton } from "../../_components/submit-button";
import { LocalTime } from "@/app/_components/local-time";

export const dynamic = "force-dynamic";
export const metadata = { title: "Blog seeds" };

const STEP_LABEL: Record<string, string> = {
  cluster: "Keywords",
  serp: "SERP analysis",
  images: "Images",
  generate: "Generate",
  done: "Done",
};

const ERRORS: Record<string, string> = {
  "invalid-title": "Give your seed a subject to get started.",
};

type SeedRow = {
  id: string;
  title: string;
  wizard_step: string;
  created_at: string;
  keyword_count: number;
  instance_count: number;
};


export default async function SeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireUser();
  const { saved, error } = await searchParams;
  const errorMessage = error ? ERRORS[error] ?? "Something went wrong." : null;

  const seedsRes = await query<SeedRow>(
    `SELECT s.id::text,
            s.title,
            s.wizard_step,
            s.created_at::text,
            (SELECT COUNT(*) FROM blog_keywords k WHERE k.seed_id = s.id)::int
              AS keyword_count,
            (SELECT COUNT(*) FROM blog_instances i WHERE i.seed_id = s.id)::int
              AS instance_count
       FROM blog_seeds s
      WHERE s.user_id = $1::bigint
      ORDER BY s.created_at DESC`,
    [me.id],
  );
  const seeds = seedsRes.rows;

  return (
    <div className="page admin-page" style={{ maxWidth: 880 }}>
      <header className="admin-header">
        <p className="eyebrow">Blog builder</p>
        <h1>Blog seeds</h1>
        <p className="sub">
          A seed is one subject you build content around. Each seed grows its
          own keyword cluster, SERP analysis, image pool, and generated blog
          posts. Start one and the wizard walks you through.
        </p>
      </header>

      {saved && !errorMessage && (
        <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
          Saved.
        </p>
      )}
      {errorMessage && (
        <div className="form-error" style={{ marginBottom: "var(--s-5)" }}>
          <p style={{ margin: 0 }}>{errorMessage}</p>
        </div>
      )}

      <section className="form-card" style={{ marginBottom: "var(--s-6)" }}>
        <h2 className="card-heading">New seed</h2>
        <p className="card-sub">
          What subject do you want to write about? You can refine the exact
          keywords in the next step.
        </p>
        <form
          action={createSeed}
          style={{
            display: "flex",
            gap: "var(--s-3)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Field label="Seed subject" htmlFor="title">
            <Input
              id="title"
              name="title"
              required
              maxLength={200}
              placeholder="e.g. electric bikes for commuters"
              style={{ minWidth: 320 }}
            />
          </Field>
          <SubmitButton variant="primary" pendingLabel="Creating…">
            Create seed →
          </SubmitButton>
        </form>
      </section>

      {seeds.length === 0 ? (
        <p style={{ color: "var(--ink-3)" }}>
          No seeds yet. Create your first one above.
        </p>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          {seeds.map((s) => (
            <li
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1fr auto",
                gap: "var(--s-3)",
                alignItems: "center",
                padding: "var(--s-3) var(--s-4)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <Link
                  href={`/app/seeds/${s.id}`}
                  style={{
                    fontWeight: 700,
                    color: "var(--ink-1)",
                    textDecoration: "none",
                    fontSize: "var(--t-body)",
                  }}
                >
                  {s.title}
                </Link>
                <div
                  style={{
                    fontSize: 12,
                    color: "var(--ink-3)",
                    marginTop: 2,
                  }}
                >
                  {STEP_LABEL[s.wizard_step] ?? s.wizard_step} ·{" "}
                  {s.keyword_count} keywords · {s.instance_count}{" "}
                  {s.instance_count === 1 ? "instance" : "instances"} · created{" "}
                  <LocalTime iso={s.created_at} dateOnly />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Link href={`/app/seeds/${s.id}`} className="btn --ghost --sm">
                  Open
                </Link>
                <form action={deleteSeed}>
                  <input type="hidden" name="seedId" value={s.id} />
                  <Button
                    type="submit"
                    variant="ghost"
                    size="sm"
                    title="Delete this seed and everything under it"
                  >
                    Delete
                  </Button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
