import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createSeed, deleteSeed } from "@/lib/actions/blog-builder";
import { listAgents } from "@/lib/agents";
import { agentAvatar } from "@/lib/agent";
import { proxiedImage } from "@/lib/image-proxy";
import { Button, Field, Input } from "../../_components/ui";
import { SubmitButton } from "../../_components/submit-button";
import { AgentPicker } from "../../_components/agent-picker";
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
  image_url: string | null;
  image_alt: string | null;
  agent_id: string | null;
  agent_name: string | null;
  agent_avatar_index: number | null;
};


export default async function SeedsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string; agent?: string }>;
}) {
  const me = await requireUser();
  const { saved, error, agent } = await searchParams;
  const errorMessage = error ? ERRORS[error] ?? "Something went wrong." : null;

  const seedsRes = await query<SeedRow>(
    `SELECT s.id::text,
            s.title,
            s.wizard_step,
            s.created_at::text,
            (SELECT COUNT(*) FROM blog_keywords k WHERE k.seed_id = s.id)::int
              AS keyword_count,
            (SELECT COUNT(*) FROM blog_instances i WHERE i.seed_id = s.id)::int
              AS instance_count,
            img.url_large AS image_url,
            img.alt       AS image_alt,
            bp.id::text   AS agent_id,
            bp.agent_name AS agent_name,
            bp.avatar_index AS agent_avatar_index
       FROM blog_seeds s
       LEFT JOIN brand_profiles bp ON bp.id = s.agent_id
       LEFT JOIN LATERAL (
         SELECT url_large, alt
           FROM blog_seed_images im
          WHERE im.seed_id = s.id
          ORDER BY im.include_in_post DESC, im.slot ASC
          LIMIT 1
       ) img ON TRUE
      WHERE s.user_id = $1::bigint
      ORDER BY s.created_at DESC`,
    [me.id],
  );
  const seeds = seedsRes.rows;
  const agents = await listAgents(me.id);
  // Pre-select the agent from ?agent= (e.g. arriving from the stable page),
  // falling back to the user's default.
  const requestedAgent = agents.find((a) => a.id === agent)?.id;
  const selectedAgentId =
    requestedAgent ?? agents.find((a) => a.isDefault)?.id ?? agents[0]?.id;

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

      <section
        className="form-card"
        style={{
          marginBottom: "var(--s-6)",
          padding: "var(--s-4)",
          gap: "var(--s-2)",
        }}
      >
        <form
          action={createSeed}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-3)",
          }}
        >
          <div
            style={{
              display: "flex",
              gap: "var(--s-3)",
              alignItems: "flex-end",
              flexWrap: "wrap",
            }}
          >
            <Field
              label="New seed subject"
              htmlFor="title"
              help="The subject to write about — refine the exact keywords next."
            >
              <Input
                id="title"
                name="title"
                required
                maxLength={200}
                placeholder="e.g. electric bikes for commuters"
                style={{ minWidth: 320 }}
              />
            </Field>
            {agents.length === 0 && (
              <SubmitButton variant="primary" pendingLabel="Creating…">
                Create seed →
              </SubmitButton>
            )}
          </div>

          {agents.length > 0 && (
            <div>
              <span
                className="field-label"
                style={{ display: "block", marginBottom: 6 }}
              >
                Choose your author
              </span>
              <AgentPicker agents={agents} selectedId={selectedAgentId} />
              <div style={{ marginTop: "var(--s-3)" }}>
                <SubmitButton variant="primary" pendingLabel="Creating…">
                  Create seed →
                </SubmitButton>
              </div>
            </div>
          )}
        </form>
        {agents.length === 0 && (
          <p className="card-sub" style={{ margin: "var(--s-2) 0 0" }}>
            You don&rsquo;t have any agents yet.{" "}
            <Link href="/app/agents" style={{ color: "var(--volt-700)" }}>
              Create an agent
            </Link>{" "}
            to give your posts a voice.
          </p>
        )}
      </section>

      {seeds.length === 0 ? (
        <p style={{ color: "var(--ink-3)" }}>
          No seeds yet. Create your first one above.
        </p>
      ) : (
        <>
        <h2 className="card-heading" style={{ margin: "0 0 var(--s-3)" }}>
          Existing Seedlings
        </h2>
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
                gridTemplateColumns: "auto 1fr auto",
                gap: "var(--s-4)",
                alignItems: "center",
                padding: "var(--s-3) var(--s-4)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
              }}
            >
              <Link
                href={`/app/seeds/${s.id}`}
                aria-hidden
                tabIndex={-1}
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 10,
                  flex: "none",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  overflow: "hidden",
                  background: "var(--surface-sunken)",
                  border: "1px solid var(--hairline)",
                }}
              >
                {s.image_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={proxiedImage(s.image_url)}
                    alt={s.image_alt ?? ""}
                    width={64}
                    height={64}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      display: "block",
                    }}
                  />
                ) : (
                  <span style={{ fontSize: 26, lineHeight: 1 }} aria-hidden>
                    🌱
                  </span>
                )}
              </Link>
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
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    marginTop: 4,
                    fontSize: 12,
                    color: "var(--ink-3)",
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={agentAvatar(s.agent_avatar_index, s.agent_id)}
                    alt=""
                    width={18}
                    height={18}
                    style={{ borderRadius: 5, display: "block", flex: "none" }}
                  />
                  {s.agent_name?.trim() || "Unassigned agent"}
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
        </>
      )}
    </div>
  );
}
