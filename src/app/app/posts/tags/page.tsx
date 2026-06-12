import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { createBlogTag, deleteBlogTag } from "@/lib/actions/blog";
import { Button, Field, Input } from "../../../_components/ui";

export const dynamic = "force-dynamic";

type TagRow = {
  id: string;
  slug: string;
  label: string;
  in_use: number;
};

export default async function AdminBlogTagsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  await requireUser();
  const { saved, error } = await searchParams;

  const r = await query<TagRow>(
    `SELECT t.id::text,
            t.slug,
            t.label,
            (SELECT COUNT(*)::int FROM blog_post_tags pt WHERE pt.tag_id = t.id) AS in_use
       FROM blog_tags t
       ORDER BY t.sort_order, t.label`,
  );
  const tags = r.rows;

  return (
    <div className="page admin-page" style={{ maxWidth: 720 }}>
      <Link href="/app/posts" className="back-link">
        ← Blog admin
      </Link>

      <header className="admin-header">
        <p className="eyebrow">Tags</p>
        <h1>Tags</h1>
        <p className="sub">
          {tags.length === 1
            ? "1 tag in use."
            : `${tags.length} tags in use.`}
        </p>
      </header>

      {saved && (
        <p className="form-success" style={{ marginBottom: "var(--s-4)" }}>
          Saved.
        </p>
      )}
      {error === "invalid-label" && (
        <p className="form-error" style={{ marginBottom: "var(--s-4)" }}>
          Tag label is required.
        </p>
      )}

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <h2 className="card-heading">Add a tag</h2>
        <p className="card-sub">The slug is auto-derived from the label.</p>
        <form
          action={createBlogTag}
          style={{
            display: "flex",
            gap: "var(--s-3)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <Field label="Label" htmlFor="label">
            <Input id="label" name="label" required maxLength={64} />
          </Field>
          <Button type="submit" variant="primary" iconRight="arrow">
            Add tag
          </Button>
        </form>
      </section>

      {tags.length === 0 ? (
        <div className="empty-state">
          <h3>No tags yet</h3>
          <p style={{ margin: 0 }}>Add your first tag above.</p>
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
          {tags.map((t) => (
            <li
              key={t.id}
              style={{
                display: "flex",
                gap: "var(--s-3)",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "var(--s-3)",
                background: "var(--surface)",
                border: "1px solid var(--hairline)",
                borderRadius: 10,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                  {t.label}
                </div>
                <div style={{ fontSize: 13, color: "var(--ink-3)" }}>
                  /blog/tag/{t.slug} · {t.in_use === 1 ? "1 post" : `${t.in_use} posts`}
                </div>
              </div>
              <form action={deleteBlogTag}>
                <input type="hidden" name="tagId" value={t.id} />
                <Button type="submit" variant="ghost" size="sm">
                  Delete
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
