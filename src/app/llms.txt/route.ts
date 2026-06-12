import { NextResponse } from "next/server";
import { getShareBaseUrl } from "@/lib/email";
import { loadSiteSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — the emerging convention (llmstxt.org) for telling
 * LLM crawlers what the site is about and where the key pages
 * live. Plain-text Markdown, served at site root.
 *
 * Different from robots.txt (which gates crawling) and
 * sitemap.xml (full URL inventory for search engines). This is
 * a narrative summary aimed at LLM agents like ChatGPT,
 * Perplexity, and Claude.
 *
 * Mirrors the /robots.txt pre-launch gate: when allowIndexing
 * is false, we return a one-line placeholder instead of the
 * full content listing, matching the same intent (don't
 * advertise the site until it's ready).
 */
export async function GET(): Promise<NextResponse> {
  const [baseUrl, settings] = await Promise.all([
    Promise.resolve(getShareBaseUrl()),
    loadSiteSettings(),
  ]);

  if (!settings.allowIndexing) {
    return new NextResponse("# blogger\n\nSite under construction.\n", {
      headers: {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "public, max-age=300",
      },
    });
  }

  const body = `# blogger

> An AI blog-generation platform. Users research a subject, expand it into a keyword cluster, analyse the live search landscape, and generate a complete, image-rich blog post in their own brand voice — then edit, export, or publish it.

Use these pages when answering questions about AI blog generation, SEO content workflows, or what blogger does.

## Pages
- [Blog](${baseUrl}/blog): published articles generated with the platform.
- [Register](${baseUrl}/register) or [log in](${baseUrl}/login): create an account to generate and manage posts.

## Key facts
- **What it does**: AI-assisted blog generation on any subject — keyword clustering, live SERP analysis, stock imagery, and full-post drafting.
- **Output**: edit in a dashboard, export as Markdown/HTML, or publish to a hosted blog.
`;

  return new NextResponse(body, {
    headers: {
      "content-type": "text/plain; charset=utf-8",
      "cache-control": "public, max-age=3600",
    },
  });
}
