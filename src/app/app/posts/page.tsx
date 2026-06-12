import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { computeContentStats } from "@/lib/blog-stats";
import { ButtonLink } from "../../_components/ui";
import { CopyToSiteButton } from "../../_components/copy-to-site";

export const dynamic = "force-dynamic";

type Row = {
  id: string;
  slug: string;
  title: string;
  body_md: string;
  published_at: string | null;
  updated_at: string;
  hero_image_id: string | null;
  views_total: string;
  views_week: string;
};

function PostStatsLine({
  bodyMd,
  viewsTotal,
  viewsWeek,
  isPublished,
}: {
  bodyMd: string;
  viewsTotal: number;
  viewsWeek: number;
  isPublished: boolean;
}) {
  const stats = computeContentStats(bodyMd);
  const parts: string[] = [
    `${stats.words.toLocaleString()} words`,
    `${stats.minutes} min read`,
  ];
  if (stats.headings > 0) parts.push(`${stats.headings}h`);
  if (stats.images > 0) parts.push(`${stats.images} img`);
  if (isPublished) {
    parts.push(
      `${viewsTotal} view${viewsTotal === 1 ? "" : "s"}${
        viewsWeek > 0 ? ` (${viewsWeek} this week)` : ""
      }`,
    );
  }
  return (
    <div
      style={{
        fontSize: 11,
        fontFamily: "var(--font-mono)",
        color: "var(--ink-3)",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        marginTop: 4,
      }}
    >
      {parts.join(" · ")}
    </div>
  );
}

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

export default async function MyPostsPage() {
  const me = await requireUser("/app/posts");

  const r = await query<Row>(
    `SELECT p.id::text,
            p.slug,
            p.title,
            p.body_md,
            p.published_at::text,
            p.updated_at::text,
            p.hero_image_id::text,
            (SELECT COUNT(*)::text FROM blog_post_views v
              WHERE v.post_id = p.id) AS views_total,
            (SELECT COUNT(*)::text FROM blog_post_views v
              WHERE v.post_id = p.id
                AND v.viewed_at > NOW() - INTERVAL '7 days') AS views_week
       FROM blog_posts p
      WHERE p.author_id = $1::bigint
      ORDER BY COALESCE(p.published_at, p.created_at) DESC`,
    [me.id],
  );
  const rows = r.rows;
  const drafts = rows.filter((r) => r.published_at == null).length;
  const published = rows.length - drafts;

  return (
    <div className="page admin-page" style={{ maxWidth: 960 }}>
      <Link href="/app" className="back-link">
        ← Dashboard
      </Link>

      <header className="admin-header">
        <p className="eyebrow">My posts</p>
        <h1>Posts</h1>
        <p className="sub">
          {rows.length} total · {published} published · {drafts} drafts
        </p>
      </header>

      <div
        style={{
          display: "flex",
          gap: "var(--s-3)",
          marginBottom: "var(--s-5)",
        }}
      >
        <ButtonLink href="/app/posts/new" variant="primary" icon="plus">
          New post
        </ButtonLink>
        <ButtonLink href="/app/posts/tags" variant="ghost">
          Manage tags
        </ButtonLink>
        <ButtonLink href="/app/seeds" variant="ghost">
          Blog seeds
        </ButtonLink>
      </div>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No posts yet</h3>
          <p style={{ margin: 0 }}>
            <Link href="/app/posts/new">Write your first post</Link>.
          </p>
        </div>
      ) : (
        <ul
          style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-3)",
          }}
        >
          {rows.map((p) => (
            <li
              key={p.id}
              style={{
                display: "grid",
                gridTemplateColumns: p.hero_image_id ? "80px 1fr auto" : "1fr auto",
                gap: "var(--s-3)",
                alignItems: "center",
                padding: "var(--s-3)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
              }}
            >
              {p.hero_image_id && (
                <img
                  src={`/api/blog/posts/${p.id}/hero`}
                  alt=""
                  style={{
                    width: 80,
                    height: 56,
                    objectFit: "cover",
                    borderRadius: 6,
                    background: "var(--surface-sunken)",
                  }}
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--ink-1)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {p.title}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  {p.published_at ? (
                    <>
                      <span className="users-tag --ok">Published</span>{" "}
                      {formatDate(p.published_at)} · /blog/{p.slug}
                    </>
                  ) : (
                    <>
                      <span className="users-tag --susp">Draft</span>{" "}
                      Updated {formatDate(p.updated_at)}
                    </>
                  )}
                </div>
                <PostStatsLine
                  bodyMd={p.body_md}
                  viewsTotal={Number(p.views_total)}
                  viewsWeek={Number(p.views_week)}
                  isPublished={p.published_at != null}
                />
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--s-3)",
                  flexShrink: 0,
                }}
              >
                <CopyToSiteButton
                  postId={p.id}
                  triggerLabel="Copy"
                  triggerClassName="btn --ghost --sm"
                />
                <Link
                  href={`/app/posts/${p.id}/edit`}
                  style={{
                    fontWeight: 600,
                    color: "var(--ink-1)",
                    fontSize: "var(--t-body-s)",
                    textDecoration: "none",
                  }}
                >
                  Edit →
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
