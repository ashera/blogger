"use server";

import { query } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { renderMarkdown } from "@/lib/blog";
import { escapeHtml, getShareBaseUrl } from "@/lib/email";

/**
 * Content for the "copy to your website" feature, in the three formats the
 * dialog offers. `html` is sanitized and self-contained; `markdown` is the
 * original source. The hero image (stored locally) is rewritten to an
 * absolute BlogSeeder URL so it still loads when pasted into an external
 * site — body images are already absolute (Pexels) and pass through as-is.
 */
export type PostExport = {
  title: string;
  html: string;
  markdown: string;
  /** True when a hero image URL was injected (so the UI can note hotlinking). */
  hasHostedImage: boolean;
};

type Row = {
  id: string;
  title: string;
  body_md: string;
  hero_image_id: string | null;
  author_id: string | null;
};

export async function getPostExport(
  postId: string,
): Promise<{ ok: true; data: PostExport } | { ok: false; error: string }> {
  const me = await getCurrentUser();
  if (!me) return { ok: false, error: "You need to be signed in." };
  if (!/^\d+$/.test(postId)) return { ok: false, error: "Invalid post." };

  const r = await query<Row>(
    `SELECT id::text,
            title,
            body_md,
            hero_image_id::text AS hero_image_id,
            author_id::text     AS author_id
       FROM blog_posts
      WHERE id = $1::bigint
      LIMIT 1`,
    [postId],
  );
  const post = r.rows[0];
  if (!post) return { ok: false, error: "Post not found." };
  // Only the author (or an admin) may export a post.
  if (post.author_id !== me.id && !me.isAdmin) {
    return { ok: false, error: "You don't have access to this post." };
  }

  const base = getShareBaseUrl().replace(/\/+$/, "");
  const heroUrl = post.hero_image_id
    ? `${base}/api/blog/posts/${post.id}/hero`
    : null;

  const title = post.title ?? "";
  const bodyHtml = renderMarkdown(post.body_md ?? "");

  const htmlParts = [`<h1>${escapeHtml(title)}</h1>`];
  if (heroUrl) {
    htmlParts.push(
      `<p><img src="${escapeHtml(heroUrl)}" alt="${escapeHtml(title)}"></p>`,
    );
  }
  htmlParts.push(bodyHtml);
  const html = htmlParts.join("\n");

  const mdParts = [`# ${title}`];
  if (heroUrl) mdParts.push(`![${title}](${heroUrl})`);
  mdParts.push(post.body_md ?? "");
  const markdown = mdParts.join("\n\n");

  return {
    ok: true,
    data: { title, html, markdown, hasHostedImage: heroUrl !== null },
  };
}
