import type { Metadata } from "next";
import Link from "next/link";
import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { getBaseUrl } from "@/lib/email";
import { brandProfileCompleteness } from "@/lib/brand-score";
import { getDefaultAgent } from "@/lib/agents";
import { agentAvatar, agentDisplayName } from "@/lib/agent";
import { ButtonLink } from "./_components/ui";

// 60s ISR. The page reads the current user cookie so it stays dynamic in
// practice, but dropping force-dynamic engages Next's data cache.
export const revalidate = 60;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const title = "BlogSeeder — AI blog generation on any subject";
  const description =
    "Generate SEO-optimised blog posts on any subject with AI — keyword research, live SERP analysis, images, and one-click publishing.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/` },
    openGraph: {
      type: "website",
      url: `${baseUrl}/`,
      title,
      description,
      siteName: "BlogSeeder",
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

type LatestBlogPost = {
  slug: string;
  title: string;
  excerpt: string | null;
};

/**
 * The post featured under the hero.
 *  - Logged out: the most recent published post by an admin author.
 *  - Logged in: the most recent published post from the user's own blog seeds.
 */
async function getHeroPost(userId: string | null): Promise<LatestBlogPost | null> {
  try {
    if (userId) {
      const r = await query<LatestBlogPost>(
        `SELECT p.slug, p.title, p.excerpt
           FROM blog_posts p
           JOIN blog_seeds s ON s.id = p.seed_id
          WHERE s.user_id = $1
            AND p.published_at IS NOT NULL
            AND p.published_at <= NOW()
          ORDER BY p.published_at DESC
          LIMIT 1`,
        [userId],
      );
      return r.rows[0] ?? null;
    }
    const r = await query<LatestBlogPost>(
      `SELECT p.slug, p.title, p.excerpt
         FROM blog_posts p
         JOIN users u ON u.id = p.author_id
        WHERE u.is_admin = TRUE
          AND p.published_at IS NOT NULL
          AND p.published_at <= NOW()
        ORDER BY p.published_at DESC
        LIMIT 1`,
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

// Mirrors the seed wizard: keywords → cluster → SERP → images → generate.
// See STEPS in src/app/_components/wizard-steps.tsx.
const STEPS: Array<{ n: string; title: string; desc: string }> = [
  {
    n: "1",
    title: "Keywords",
    desc: "Drop in a topic and a few starter phrases to seed the post.",
  },
  {
    n: "2",
    title: "Cluster",
    desc: "We expand them into a tight cluster of related search queries — review and refine the set.",
  },
  {
    n: "3",
    title: "SERP analysis",
    desc: "Live web search reads the top-ranking pages so your draft covers what actually ranks.",
  },
  {
    n: "4",
    title: "Images",
    desc: "Add matching photography from a curated image pool for the hero and body.",
  },
  {
    n: "5",
    title: "Generate",
    desc: "AI writes a complete, image-rich draft in your brand voice — edit, publish, or copy to your own site.",
  },
];

/** Encouragement copy for the agent-training meter. */
function brandMeterMessage(pct: number, name: string): string {
  if (pct >= 100) return `Refine ${name}'s training`;
  if (pct === 0) return `Start training ${name}`;
  if (pct < 34) return `Keep training ${name}`;
  if (pct < 67) return `${name} is learning — keep going`;
  return `Almost there — finish ${name}'s training`;
}

export default async function Home() {
  const user = await getCurrentUser();
  const [latestPost, agent] = await Promise.all([
    getHeroPost(user?.id ?? null),
    user ? getDefaultAgent(user.id) : Promise.resolve(null),
  ]);
  const brandPct = agent ? brandProfileCompleteness(agent) : null;

  return (
    <div className="page">
      <section className="hero-photo">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/blogseeder-hero.jpg" alt="Seedlings growing from soil" />
        <div className="scrim" />
        <div className="hero-content">
          <p className="eyebrow">AI blog generation</p>
          <h1>
            Plant a topic. <span className="accent">Grow</span> a blog.
          </h1>
          <p className="sub">
            Keyword research, live SERP analysis, imagery, and a finished draft
            in your brand voice — the whole pipeline, on autopilot.
          </p>
          <div
            style={{
              display: "flex",
              gap: "var(--s-3)",
              marginTop: "var(--s-7)",
              flexWrap: "wrap",
              alignItems: "center",
            }}
          >
            {user ? (
              <>
                <ButtonLink href="/app/seeds" variant="primary" size="lg" iconRight="arrow">
                  Seed a Blog Post
                </ButtonLink>
                <Link
                  href="/app/seeds"
                  className="btn --lg"
                  style={{
                    background: "transparent",
                    color: "#fff",
                    border: "1px solid rgba(255,255,255,0.55)",
                  }}
                >
                  View Existing Seedlings
                </Link>
              </>
            ) : (
              <ButtonLink href="/register" variant="primary" size="lg" iconRight="arrow">
                Start generating
              </ButtonLink>
            )}
          </div>
        </div>

        {user && agent && brandPct !== null && (
          <Link href={`/app/agents/${agent.id}`} className="hero-brand-meter">
            <div className="row" style={{ alignItems: "center", gap: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={agentAvatar(agent.avatarIndex, agent.id)}
                alt=""
                width={36}
                height={36}
                style={{ borderRadius: 8, display: "block", flex: "none" }}
              />
              <span style={{ flex: 1, minWidth: 0 }}>
                <span className="label" style={{ display: "block" }}>
                  {agent.agentName?.trim()
                    ? `Your agent · ${agent.agentName.trim()}`
                    : "Your blogging agent"}
                </span>
                <span style={{ fontSize: 12, opacity: 0.85 }}>
                  Trained <strong>{brandPct}%</strong>
                </span>
              </span>
            </div>
            <span className="msg">
              {brandMeterMessage(brandPct, agentDisplayName(agent.agentName))} →
            </span>
            <div className="bar" aria-hidden>
              <span style={{ width: `${brandPct}%` }} />
            </div>
          </Link>
        )}
      </section>

      {latestPost && (
        <section style={{ padding: "var(--s-5) 0 0" }}>
          <Link
            href={`/blog/${latestPost.slug}`}
            style={{
              display: "block",
              padding: "var(--s-3) var(--s-4)",
              background: "var(--surface-sunken)",
              border: "1px solid var(--hairline)",
              borderRadius: 10,
              textDecoration: "none",
              color: "inherit",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "var(--s-2)",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  fontFamily: "var(--font-mono)",
                  letterSpacing: "0.16em",
                  textTransform: "uppercase",
                  color: "var(--volt-700)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                {user ? "Your most recent post:" : "Latest post:"}
              </span>
              <span
                style={{
                  fontWeight: 700,
                  color: "var(--ink-1)",
                  flex: "1 1 0",
                  minWidth: 0,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {latestPost.title}
              </span>
              <span
                style={{
                  color: "var(--ink-2)",
                  fontSize: "var(--t-body-s)",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                Read →
              </span>
            </div>
          </Link>
        </section>
      )}

      <section className="section">
        <p className="eyebrow">How it works</p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            color: "var(--ink-1)",
            margin: "0 0 var(--s-7)",
            lineHeight: 1,
            letterSpacing: "-0.02em",
            maxWidth: "20ch",
          }}
        >
          From idea to published post.
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "var(--s-4)",
          }}
        >
          {STEPS.map((s) => (
            <div
              key={s.n}
              style={{
                padding: "var(--s-4)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 12,
              }}
            >
              <div
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 12,
                  color: "var(--volt-700)",
                  fontWeight: 700,
                  marginBottom: 8,
                }}
              >
                STEP {s.n}
              </div>
              <h3
                style={{
                  margin: "0 0 6px",
                  fontSize: 18,
                  color: "var(--ink-1)",
                }}
              >
                {s.title}
              </h3>
              <p style={{ margin: 0, color: "var(--ink-3)", lineHeight: 1.5 }}>
                {s.desc}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
