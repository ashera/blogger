import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { loadBrandProfile, type BrandProfile } from "@/lib/brand-profile";
import { ButtonLink } from "../_components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard" };

const STEP_LABEL: Record<string, string> = {
  keywords: "Keywords",
  cluster: "Cluster",
  serp: "SERP analysis",
  images: "Images",
  generate: "Generate",
  done: "Done",
};

function formatDate(s: string | null): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

// ---------------------------------------------------------------------------
// Brand-profile completeness
// ---------------------------------------------------------------------------

type FieldStatus = "good" | "brief" | "missing";

type FieldAssessment = {
  label: string;
  status: FieldStatus;
  weight: number;
  impact: string; // shown when not "good"
};

// Recommended minimum lengths (chars) for each field to meaningfully steer
// generation, plus the impact on output when missing or too brief.
const BRAND_FIELDS: Array<{
  key: keyof BrandProfile;
  label: string;
  recommend: number;
  weight: number;
  missingImpact: string;
  briefImpact: string;
}> = [
  {
    key: "voice",
    label: "Voice & tone",
    recommend: 160,
    weight: 3,
    missingImpact:
      "Posts fall back to generic AI prose — this is the single biggest driver of how your blog reads.",
    briefImpact:
      "Too thin to imitate. Add detail and a sample sentence or two so posts sound distinctly like you.",
  },
  {
    key: "humour",
    label: "Humour & wit",
    recommend: 120,
    weight: 2,
    missingImpact:
      "Posts won't carry a distinct sense of humour — fine if you want straight prose, but wit is a big part of a memorable voice.",
    briefImpact:
      "Add detail on the kind of humour and where it lands so it reads deliberate, not random.",
  },
  {
    key: "audience",
    label: "Audience",
    recommend: 50,
    weight: 3,
    missingImpact:
      "The writer pitches at a generic reader instead of your actual audience — depth and framing will be off.",
    briefImpact:
      "Spell out who they are, their level and goals so posts pitch at the right depth.",
  },
  {
    key: "perspective",
    label: "Point of view",
    recommend: 50,
    weight: 2,
    missingImpact:
      "Posts stay neutral and hedged, with no editorial stance of their own.",
    briefImpact:
      "Add a few opinions the writer should hold so posts take a real position.",
  },
  {
    key: "avoid",
    label: "Things to avoid",
    recommend: 25,
    weight: 2,
    missingImpact:
      "No guardrails — the writer may use hype words, off-brand claims, or styles you'd never publish.",
    briefImpact: "List more words, claims, or styles to steer clear of.",
  },
  {
    key: "brandName",
    label: "Brand / blog name",
    recommend: 2,
    weight: 1,
    missingImpact: "The prompt has no brand name to anchor the writing to.",
    briefImpact: "",
  },
];

function assessBrand(p: BrandProfile): {
  fields: FieldAssessment[];
  percent: number;
  verdict: string;
} {
  let credit = 0;
  let total = 0;
  const fields: FieldAssessment[] = BRAND_FIELDS.map((f) => {
    total += f.weight;
    const raw = (p[f.key] ?? "").trim();
    let status: FieldStatus;
    if (raw.length === 0) status = "missing";
    else if (raw.length < f.recommend) status = "brief";
    else status = "good";
    credit += status === "good" ? f.weight : status === "brief" ? f.weight / 2 : 0;
    const impact =
      status === "missing"
        ? f.missingImpact
        : status === "brief"
          ? f.briefImpact
          : "";
    return { label: f.label, status, weight: f.weight, impact };
  });
  const percent = Math.round((credit / total) * 100);
  const verdict =
    percent >= 100
      ? "Fully configured — generated posts will lean hard on your brand."
      : percent >= 70
        ? "Solid. Closing the gaps below will sharpen the output further."
        : percent >= 40
          ? "Partly set up. The gaps below noticeably affect how posts read."
          : "Barely configured — posts will read generic until you fill the high-impact fields below.";
  return { fields, percent, verdict };
}

const STATUS_META: Record<
  FieldStatus,
  { label: string; tag: string; color: string }
> = {
  good: { label: "Good", tag: "users-tag --ok", color: "var(--ink-3)" },
  brief: { label: "Too brief", tag: "users-tag --susp", color: "var(--warn-700)" },
  missing: { label: "Missing", tag: "users-tag --susp", color: "var(--danger-700)" },
};

// ---------------------------------------------------------------------------

type SeedRow = {
  id: string;
  title: string;
  wizard_step: string;
  created_at: string;
  keyword_count: number;
  instance_count: number;
};

type PostRow = {
  id: string;
  title: string;
  published_at: string | null;
  created_at: string;
  views: number;
};

export default async function DashboardPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/app");

  const [profile, seedsRes, postsRes] = await Promise.all([
    loadBrandProfile(user.id),
    query<SeedRow>(
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
        ORDER BY s.created_at DESC
        LIMIT 5`,
      [user.id],
    ),
    query<PostRow>(
      `SELECT p.id::text,
              p.title,
              p.published_at::text,
              p.created_at::text,
              (SELECT COUNT(*) FROM blog_post_views v WHERE v.post_id = p.id)::int
                AS views
         FROM blog_posts p
        WHERE p.author_id = $1::bigint
        ORDER BY p.created_at DESC
        LIMIT 5`,
      [user.id],
    ),
  ]);
  const seeds = seedsRes.rows;
  const posts = postsRes.rows;
  const brand = assessBrand(profile);

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 880, margin: "0 auto" }}>
        <p className="eyebrow">Dashboard</p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "var(--t-h1)",
            color: "var(--ink-1)",
            margin: "var(--s-2) 0 var(--s-5)",
            letterSpacing: "-0.02em",
          }}
        >
          Welcome, {user.firstName || user.email.split("@")[0]}
        </h1>

        {/* 1 — Brand profile + completeness */}
        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--s-3)",
              flexWrap: "wrap",
              alignItems: "flex-start",
            }}
          >
            <div style={{ maxWidth: "52ch" }}>
              <h2 className="card-heading" style={{ margin: 0 }}>
                Brand profile
              </h2>
              <p className="card-sub" style={{ marginTop: 4 }}>
                Your editorial identity — voice, audience, point of view, and
                things to avoid. Every post is generated through it, so the more
                complete it is, the more the writing sounds like you instead of
                generic AI.
              </p>
            </div>
            <ButtonLink href="/app/brand" variant="dark" iconRight="arrow">
              Edit brand profile
            </ButtonLink>
          </div>

          {/* completeness bar */}
          <div style={{ marginTop: "var(--s-4)" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "baseline",
                marginBottom: 6,
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                Completeness
              </span>
              <strong style={{ color: "var(--ink-1)" }}>{brand.percent}%</strong>
            </div>
            <div
              style={{
                height: 8,
                borderRadius: 999,
                background: "var(--surface-sunken)",
                border: "1px solid var(--hairline)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${brand.percent}%`,
                  height: "100%",
                  background:
                    brand.percent >= 70
                      ? "var(--volt-300)"
                      : brand.percent >= 40
                        ? "var(--warn-500)"
                        : "var(--danger-500)",
                }}
              />
            </div>
            <p
              style={{
                margin: "var(--s-3) 0 0",
                color: "var(--ink-2)",
                fontSize: "var(--t-body-s)",
              }}
            >
              {brand.verdict}
            </p>
          </div>

          {/* per-field assessment */}
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: "var(--s-4) 0 0",
              display: "flex",
              flexDirection: "column",
              gap: 6,
            }}
          >
            {brand.fields.map((f) => (
              <li
                key={f.label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "auto 140px 1fr",
                  gap: "var(--s-3)",
                  alignItems: "start",
                  padding: "8px 12px",
                  background: f.status === "good" ? "var(--surface)" : "var(--surface-sunken)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 8,
                }}
              >
                <span className={STATUS_META[f.status].tag}>
                  {STATUS_META[f.status].label}
                </span>
                <span style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                  {f.label}
                </span>
                <span
                  style={{
                    fontSize: "var(--t-body-s)",
                    color: STATUS_META[f.status].color,
                  }}
                >
                  {f.status === "good" ? "Looks good." : f.impact}
                </span>
              </li>
            ))}
          </ul>
        </section>

        {/* 2 — Blog seeds */}
        <DashCard
          title="My blog seeds"
          subtitle="Each seed is a subject you build content around — keywords, research, images, and generated posts."
          href="/app/seeds"
          linkLabel="All seeds"
          isEmpty={seeds.length === 0}
          emptyText="No seeds yet. Start one to spin up a blog around a subject."
          emptyCta={{ href: "/app/seeds", label: "Create your first seed" }}
        >
          <DashTable head={["Seed", "Stage", "Keywords", "Posts", "Created"]}>
            {seeds.map((s) => (
              <tr key={s.id}>
                <td>
                  <Link href={`/app/seeds/${s.id}`} className="dash-row-link">
                    {s.title}
                  </Link>
                </td>
                <td>{STEP_LABEL[s.wizard_step] ?? s.wizard_step}</td>
                <td>{s.keyword_count}</td>
                <td>{s.instance_count}</td>
                <td>{formatDate(s.created_at)}</td>
              </tr>
            ))}
          </DashTable>
        </DashCard>

        {/* 3 — Posts */}
        <DashCard
          title="My posts"
          subtitle="Drafts and published articles. Generated posts land here as drafts to review and publish."
          href="/app/posts"
          linkLabel="All posts"
          isEmpty={posts.length === 0}
          emptyText="No posts yet. Generate one from a seed, or write one by hand."
          emptyCta={{ href: "/app/posts/new", label: "Write a post" }}
        >
          <DashTable head={["Title", "Status", "Views", "Created"]}>
            {posts.map((p) => {
              const scheduled =
                p.published_at != null &&
                new Date(p.published_at).getTime() > Date.now();
              const published = p.published_at != null && !scheduled;
              return (
                <tr key={p.id}>
                  <td>
                    <Link
                      href={`/app/posts/${p.id}/edit`}
                      className="dash-row-link"
                    >
                      {p.title}
                    </Link>
                  </td>
                  <td>
                    <span
                      className={
                        published
                          ? "users-tag --ok"
                          : scheduled
                            ? "users-tag"
                            : "users-tag --susp"
                      }
                    >
                      {published ? "Published" : scheduled ? "Scheduled" : "Draft"}
                    </span>
                  </td>
                  <td>{published ? p.views : "—"}</td>
                  <td>{formatDate(p.created_at)}</td>
                </tr>
              );
            })}
          </DashTable>
        </DashCard>
      </main>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small presentational helpers
// ---------------------------------------------------------------------------

function DashCard({
  title,
  subtitle,
  href,
  linkLabel,
  isEmpty,
  emptyText,
  emptyCta,
  children,
}: {
  title: string;
  subtitle: string;
  href: string;
  linkLabel: string;
  isEmpty: boolean;
  emptyText: string;
  emptyCta: { href: string; label: string };
  children: React.ReactNode;
}) {
  return (
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
        <div style={{ maxWidth: "52ch" }}>
          <h2 className="card-heading" style={{ margin: 0 }}>
            {title}
          </h2>
          <p className="card-sub" style={{ marginTop: 4 }}>
            {subtitle}
          </p>
        </div>
        <Link href={href} className="btn --ghost --sm">
          {linkLabel} →
        </Link>
      </div>
      {isEmpty ? (
        <p style={{ color: "var(--ink-3)", margin: 0 }}>
          {emptyText}{" "}
          <Link href={emptyCta.href}>{emptyCta.label}</Link>.
        </p>
      ) : (
        children
      )}
    </section>
  );
}

function DashTable({
  head,
  children,
}: {
  head: string[];
  children: React.ReactNode;
}) {
  return (
    <table className="dash-table">
      <thead>
        <tr>
          {head.map((h) => (
            <th key={h}>{h}</th>
          ))}
        </tr>
      </thead>
      <tbody>{children}</tbody>
    </table>
  );
}
