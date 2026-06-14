import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { loadBrandProfile, assessBrand } from "@/lib/brand-profile";
import { agentAvatarSrc } from "@/lib/agent";
import { ButtonLink } from "../_components/ui";
import { LocalTime } from "@/app/_components/local-time";

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

        {/* 1 — Blogging agent (training) */}
        <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "var(--s-3)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--s-3)",
                minWidth: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agentAvatarSrc(user.id)}
                alt=""
                width={56}
                height={56}
                style={{ borderRadius: 14, display: "block", flex: "none" }}
              />
              <div style={{ minWidth: 0 }}>
                <h2 className="card-heading" style={{ margin: 0 }}>
                  {profile.agentName?.trim()
                    ? profile.agentName.trim()
                    : "Your blogging agent"}
                </h2>
                <p className="card-sub" style={{ marginTop: 4, maxWidth: "48ch" }}>
                  The persona that writes your posts. Training shapes its voice,
                  audience, and point of view — the more trained, the more your
                  posts sound like you.
                </p>
              </div>
            </div>
            <ButtonLink href="/app/brand" variant="dark" iconRight="arrow">
              {brand.percent >= 100 ? "Refine training" : "Train your agent"}
            </ButtonLink>
          </div>

          {/* training meter */}
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
                Trained
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
                <td><LocalTime iso={s.created_at} dateOnly /></td>
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
                  <td><LocalTime iso={p.created_at} dateOnly /></td>
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
