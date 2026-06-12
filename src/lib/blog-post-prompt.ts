// Composes the system + user prompt that the Generate Post action sends to
// Claude. Kept as pure strings (no SDK calls, no server-only deps) so the
// cluster page can render a preview dialog before any real send.

type SerpTopResult = {
  rank?: number;
  url?: string;
  title?: string;
  domain?: string;
  format?: string;
  estimated_word_count?: number;
  topics_covered?: string[];
};

export type PostPromptSerp = {
  summary?: string;
  top_results?: SerpTopResult[];
  average_word_count?: number;
  target_word_count?: string;
  common_topics?: string[];
  missing_topics_to_add?: string[];
  recommended_format?: string;
  format_rationale?: string;
};

export type PostPromptCluster = {
  name: string;
  intent: string | null;
};

export type PostPromptMember = {
  phrase: string;
  is_primary: boolean;
};

export type PostPromptImage = {
  slot: number;
  photographer: string | null;
  alt: string | null;
  source_url: string | null;
};

/**
 * The author's editorial identity, mirroring the BrandProfile shape but
 * decoupled so this module stays free of server-only imports. Any field may
 * be null — the prompt skips empty sections.
 */
export type PostPromptBrand = {
  brandName: string | null;
  siteUrl: string | null;
  audience: string | null;
  voice: string | null;
  humour: string | null;
  perspective: string | null;
  stats: string | null;
  stories: string | null;
  avoid: string | null;
};

// Character budgets for the brand-profile fields injected into the prompt.
// These MUST match the maxLength caps on the brand-profile form
// (src/app/app/brand/page.tsx) so whatever a user can type is sent in full —
// a smaller budget here would silently drop the tail of their input. The clip
// then only ever fires as a safety net for over-long legacy/imported values.
const BRAND_BUDGETS = {
  audience: 600,
  voice: 8000,
  humour: 8000,
  perspective: 4000,
  stats: 6000,
  stories: 8000,
  avoid: 2000,
} as const;

function clipForPrompt(body: string | null, maxChars: number): string | null {
  if (!body) return null;
  const trimmed = body.trim();
  if (trimmed.length <= maxChars) return trimmed;
  const slice = trimmed.slice(0, maxChars);
  const lastPara = slice.lastIndexOf("\n\n");
  if (lastPara > maxChars * 0.7) {
    return slice.slice(0, lastPara).trimEnd();
  }
  return slice.replace(/\s+\S*$/, "").trimEnd();
}

const POST_SYSTEM_BASE = `You are an expert blog writer and SEO content strategist. You write complete, publish-ready articles on any subject.

Given a keyword cluster, a SERP landscape analysis, hero images, and a brand profile, write a single complete blog post that targets the cluster's primary keyword while naturally covering its related queries.

Rules:
- Title and first paragraph must clearly target the primary keyword.
- Match the recommended format (listicle, guide, comparison, tutorial). Target word count: aim for the SERP recommendation but cap at 1,800 words MAX regardless of what SERP suggests — going longer truncates the response.
- Cover EVERY topic in "Common topics" — these are table-stakes per the SERP.
- Treat "Gap topics" as differentiators — cover them deeper than any of the top-ranking pages.
- Weave the secondary cluster keywords in naturally throughout. Do not keyword-stuff.
- Write in the author's VOICE (see brand profile). Match its tone, rhythm, and vocabulary — NOT generic AI prose. If no voice is given, default to clear, confident, helpful expert prose.
- Apply the author's HUMOUR & WIT guide (see brand profile) throughout — the wit should feel woven in and natural, never bolted on. If no humour guide is given, keep a light, natural touch and don't force jokes.
- Write for the stated AUDIENCE.
- Where the brand has a POINT OF VIEW, bake those stances in as genuine editorial opinions rather than hedged neutrality.
- Cite any KEY FACTS & STATS provided verbatim — never round them, and never invent figures that weren't given.
- Where STORIES & ANECDOTES are provided, adapt the relevant ones into the post naturally; don't shoehorn them in if they don't fit.
- Respect the AVOID list strictly.
- Where the topic genuinely connects to one of the EXISTING POSTS YOU CAN LINK TO, drop a markdown link to it ([anchor text](/blog/slug)) — natural cross-references only, never forced. Aim for 1–3 internal links per post if relevant ones exist; zero is fine if none fit.
- Tags: pick 3–5 from AVAILABLE TAGS only. Do not invent new tags — anything outside the list will be discarded.
- For each hero image, supply an image_placement entry with the slot, the EXACT H2 heading text it should appear after, a one-sentence caption, and a layout choice. The platform inserts the actual image and credit programmatically — do NOT embed image markdown in body_markdown yourself.
- Layout choices for image_placements: "full" = full-width break (use sparingly), "right" = float right with text wrapping, "left" = float left with text wrapping. AIM FOR VARIETY: mix one full + several right/left so the page has visual rhythm.

Submit your post by calling the submit_post tool exactly once with all fields filled in. Do not write any free-text response — call the tool and stop.`;

export function composePostSystemPrompt(brand: PostPromptBrand): string {
  const parts: string[] = [POST_SYSTEM_BASE];

  const voice = clipForPrompt(brand.voice, BRAND_BUDGETS.voice);
  if (voice) {
    parts.push("");
    parts.push("=== VOICE GUIDE ===");
    parts.push(voice);
  }
  const humour = clipForPrompt(brand.humour, BRAND_BUDGETS.humour);
  if (humour) {
    parts.push("");
    parts.push("=== HUMOUR & WIT ===");
    parts.push(humour);
  }
  const avoid = clipForPrompt(brand.avoid, BRAND_BUDGETS.avoid);
  if (avoid) {
    parts.push("");
    parts.push("=== AVOID (strict) ===");
    parts.push(avoid);
  }
  return parts.join("\n");
}

export type PostPromptExistingPost = {
  slug: string;
  title: string;
  tags: string[];
};

export function composePostUserPrompt(opts: {
  cluster: PostPromptCluster;
  members: PostPromptMember[];
  serp: PostPromptSerp | null;
  images: PostPromptImage[];
  brand: PostPromptBrand;
  existingPosts: PostPromptExistingPost[];
  availableTags: string[];
  // Optional angle/brief for this instance. When several posts are generated
  // from one seed, this is what makes each a distinct take on the subject.
  angle?: string | null;
}): string {
  const {
    cluster,
    members,
    serp,
    images,
    brand,
    existingPosts,
    availableTags,
    angle,
  } = opts;
  const primary = members.find((m) => m.is_primary);
  const secondary = members.filter((m) => !m.is_primary);

  const lines: string[] = [];

  // Brand context up top so the model frames everything around it.
  lines.push("BRAND PROFILE");
  if (brand.brandName) lines.push(`Brand: ${brand.brandName}`);
  if (brand.siteUrl) lines.push(`Site: ${brand.siteUrl}`);
  const audience = clipForPrompt(brand.audience, BRAND_BUDGETS.audience);
  lines.push(`Audience: ${audience ?? "(not specified — write for a general informed reader)"}`);
  const perspective = clipForPrompt(brand.perspective, BRAND_BUDGETS.perspective);
  if (perspective) {
    lines.push("Point of view (bake these stances in):");
    lines.push(perspective);
  }
  const stats = clipForPrompt(brand.stats, BRAND_BUDGETS.stats);
  if (stats) {
    lines.push("");
    lines.push(
      "KEY FACTS & STATS (cite these verbatim where relevant — do NOT round or invent numbers; use only figures from this list):",
    );
    lines.push(stats);
  }
  const stories = clipForPrompt(brand.stories, BRAND_BUDGETS.stories);
  if (stories) {
    lines.push("");
    lines.push(
      "STORIES & ANECDOTES (adapt the relevant ones naturally; skip any that don't fit):",
    );
    lines.push(stories);
  }
  lines.push("");

  lines.push(`PRIMARY KEYWORD: "${primary?.phrase ?? "(none set)"}"`);
  lines.push(`INTENT: ${cluster.intent ?? "unspecified"}`);
  lines.push(`CLUSTER NAME: "${cluster.name}"`);
  const angleText = clipForPrompt(angle ?? null, 500);
  if (angleText) {
    lines.push("");
    lines.push(
      `ANGLE / FOCUS FOR THIS POST: ${angleText}`,
    );
    lines.push(
      "Shape the whole post around this angle while still targeting the primary keyword.",
    );
  }
  lines.push("");

  lines.push("SECONDARY KEYWORDS (cover these naturally):");
  if (secondary.length === 0) {
    lines.push("- (none)");
  } else {
    for (const m of secondary) lines.push(`- ${m.phrase}`);
  }
  lines.push("");

  lines.push("SERP ANALYSIS");
  if (!serp) {
    lines.push("(not yet run)");
  } else {
    lines.push(`Recommended format: ${serp.recommended_format ?? "unspecified"}`);
    lines.push(
      `Target length: ${
        serp.target_word_count ??
        (serp.average_word_count
          ? `~${serp.average_word_count} words`
          : "unspecified")
      }`,
    );
    if (serp.format_rationale) {
      lines.push(`Format rationale: ${serp.format_rationale}`);
    }
    if (serp.summary) {
      lines.push(`SERP summary: ${serp.summary}`);
    }
    lines.push("");
    lines.push("Common topics (must cover):");
    const common = (serp.common_topics ?? []).slice(0, 10);
    if (common.length === 0) lines.push("- (none identified)");
    else for (const t of common) lines.push(`- ${t}`);
    lines.push("");
    lines.push("Gap topics (use as differentiators):");
    const gaps = (serp.missing_topics_to_add ?? []).slice(0, 4);
    if (gaps.length === 0) lines.push("- (none identified)");
    else for (const t of gaps) lines.push(`- ${t}`);
    lines.push("");
    lines.push("Top 3 ranking pages (write something better):");
    const top = (serp.top_results ?? []).slice(0, 3);
    if (top.length === 0) {
      lines.push("(none captured)");
    } else {
      for (const r of top) {
        const head = `${r.rank ?? "?"}. ${r.title ?? "(no title)"} — ${
          r.domain ?? "?"
        } — ${r.format ?? "?"} — ${
          r.estimated_word_count ? `~${r.estimated_word_count} words` : "?"
        }`;
        lines.push(head);
        const topics = (r.topics_covered ?? []).slice(0, 6);
        if (topics.length > 0) {
          lines.push(`   topics: ${topics.join(", ")}`);
        }
      }
    }
  }
  lines.push("");

  lines.push("EXISTING POSTS YOU CAN LINK TO (use [anchor](/blog/slug) markdown):");
  if (existingPosts.length === 0) {
    lines.push("(none — skip cross-linking for this post)");
  } else {
    for (const p of existingPosts) {
      const tagSuffix = p.tags.length > 0 ? ` — ${p.tags.join(", ")}` : "";
      lines.push(`- [${p.title}](/blog/${p.slug})${tagSuffix}`);
    }
  }
  lines.push("");

  lines.push("AVAILABLE TAGS (pick 3–5 from this list only):");
  if (availableTags.length === 0) {
    lines.push("(none — leave the tags array empty)");
  } else {
    lines.push(availableTags.join(", "));
  }
  lines.push("");

  lines.push("HERO IMAGES");
  lines.push(
    "The first image below becomes the hero banner at the top of the post automatically — do NOT include it in image_placements. Use image_placements only for the remaining images, referencing them by slot number.",
  );
  if (images.length === 0) {
    lines.push("(none included)");
  } else {
    let isFirst = true;
    for (const img of images) {
      const photog = img.photographer ?? "unknown photographer";
      const alt = img.alt ?? "(no alt)";
      const link = img.source_url ?? "(no link)";
      const tag = isFirst ? " [HERO]" : "";
      lines.push(`- Slot ${img.slot}${tag} — by ${photog} — alt: "${alt}" — ${link}`);
      isFirst = false;
    }
  }
  lines.push("");

  lines.push("Write the post now and call submit_post.");

  return lines.join("\n");
}
