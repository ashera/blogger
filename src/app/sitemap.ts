import type { MetadataRoute } from "next";
import { query } from "@/lib/db";
import { getBaseUrl } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = await getBaseUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${baseUrl}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${baseUrl}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
  ];

  let posts: { slug: string; published_at: string; updated_at: string }[] = [];
  try {
    const r = await query<{ slug: string; published_at: string; updated_at: string }>(
      `SELECT slug, published_at::text, updated_at::text
         FROM blog_posts
        WHERE published_at IS NOT NULL AND published_at <= NOW()
        ORDER BY published_at DESC`,
    );
    posts = r.rows;
  } catch {
    // sitemap should still serve even if DB hiccups
  }

  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${baseUrl}/blog/${p.slug}`,
    lastModified: new Date(p.updated_at),
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let tagSlugs: { slug: string }[] = [];
  try {
    const r = await query<{ slug: string }>(
      `SELECT DISTINCT t.slug
         FROM blog_tags t
         JOIN blog_post_tags pt ON pt.tag_id = t.id
         JOIN blog_posts p ON p.id = pt.post_id
        WHERE p.published_at IS NOT NULL AND p.published_at <= NOW()`,
    );
    tagSlugs = r.rows;
  } catch {
    // sitemap should still serve even if DB hiccups
  }

  const tagEntries: MetadataRoute.Sitemap = tagSlugs.map((t) => ({
    url: `${baseUrl}/blog/tag/${t.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.5,
  }));

  return [...staticEntries, ...postEntries, ...tagEntries];
}
