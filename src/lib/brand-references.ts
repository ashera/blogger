import "server-only";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Source text from the inherited /references files (the demo "frockd" brand),
 * used as the example the AI rewrites into the user's own brand sections. One
 * entry per AI-generated section. Read server-side only.
 */
const MAX_REF_CHARS = 2400;

const fileCache = new Map<string, string>();

function readRef(file: string): string {
  if (fileCache.has(file)) return fileCache.get(file)!;
  let content = "";
  try {
    content = readFileSync(
      join(process.cwd(), "references", `${file}.md`),
      "utf8",
    );
  } catch {
    content = "";
  }
  fileCache.set(file, content);
  return content;
}

/** Whole file minus the H1 title and leading "> " blockquote intro, trimmed. */
function body(file: string): string {
  const md = readRef(file);
  if (!md) return "";
  const lines = md.split(/\r?\n/).filter((l) => {
    const t = l.trim();
    if (t.startsWith("# ")) return false; // H1 title
    if (t.startsWith(">")) return false; // blockquote instructions
    return true;
  });
  return clip(lines.join("\n").trim());
}

/** Extract the body under a "## heading" (until the next level-2 heading). */
function section(file: string, headingPrefix: string): string {
  const md = readRef(file);
  if (!md) return "";
  const lines = md.split(/\r?\n/);
  const pfx = headingPrefix.toLowerCase();
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#{2,3}\s+(.*)$/);
    if (m && m[1].trim().toLowerCase().startsWith(pfx)) {
      start = i;
      break;
    }
  }
  if (start === -1) return "";
  const out: string[] = [lines[start]];
  for (let j = start + 1; j < lines.length; j++) {
    if (/^#{2}\s/.test(lines[j])) break;
    out.push(lines[j]);
  }
  return out.join("\n").trim();
}

function clip(s: string): string {
  if (s.length <= MAX_REF_CHARS) return s;
  const slice = s.slice(0, MAX_REF_CHARS);
  const lastBreak = slice.lastIndexOf("\n");
  return (lastBreak > MAX_REF_CHARS * 0.5
    ? slice.slice(0, lastBreak)
    : slice
  ).trim();
}

/** Source reference text per generated section (key → example markdown). */
export function loadBrandReferenceText(): Record<string, string> {
  return {
    voice: body("voice"),
    humour: body("humour"),
    perspective: body("opinions"),
    stats: body("stats"),
    stories: body("stories"),
    avoid: clip(
      [
        section("voice", "Words she never uses"),
        section("voice", "Tells that it"),
      ]
        .filter(Boolean)
        .join("\n\n"),
    ),
  };
}
