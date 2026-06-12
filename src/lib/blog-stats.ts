import "server-only";
import { stripMarkdown } from "@/lib/blog";

export type PostContentStats = {
  words: number;
  /** Estimated reading minutes at 200 wpm. Always at least 1. */
  minutes: number;
  /** Count of headings at any level (#, ##, ###, …). */
  headings: number;
  /** Count of images — markdown ![]() or raw <img>/<figure> tags. */
  images: number;
  /** Internal link count — [text](/path). */
  internalLinks: number;
  /** External link count — [text](https://…). */
  externalLinks: number;
};

const WORD_RE = /\S+/g;
const HEADING_RE = /^#{1,6}\s+\S/gm;
const MD_IMAGE_RE = /!\[[^\]]*\]\([^)]+\)/g;
const HTML_IMAGE_RE = /<(?:img|figure)\b/gi;
const LINK_RE = /\[[^\]]+\]\(([^)\s]+)/g;

export function computeContentStats(bodyMd: string): PostContentStats {
  const text = stripMarkdown(bodyMd, 1_000_000);
  const words = text.match(WORD_RE)?.length ?? 0;
  const minutes = Math.max(1, Math.round(words / 200));
  const headings = bodyMd.match(HEADING_RE)?.length ?? 0;
  const images =
    (bodyMd.match(MD_IMAGE_RE)?.length ?? 0) +
    (bodyMd.match(HTML_IMAGE_RE)?.length ?? 0);

  let internalLinks = 0;
  let externalLinks = 0;
  for (const m of bodyMd.matchAll(LINK_RE)) {
    const href = m[1];
    if (!href) continue;
    if (href.startsWith("/")) internalLinks += 1;
    else if (/^https?:\/\//i.test(href)) externalLinks += 1;
  }

  return { words, minutes, headings, images, internalLinks, externalLinks };
}

export function daysSince(s: string | null): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / (1000 * 60 * 60 * 24)));
}
