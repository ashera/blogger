"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { query, withTransaction } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import {
  callClaude,
  extractJson,
  WEB_FETCH_TOOL,
  WEB_SEARCH_TOOL,
} from "@/lib/anthropic";

// Structured-output tool for the post-generation call. We tell Claude to
// invoke this tool instead of writing JSON in text — Anthropic returns
// the input as a parsed object, sidestepping every malformed-JSON failure
// (unescaped quotes inside body_markdown, control chars, truncation, etc).
const SUBMIT_POST_TOOL = {
  name: "submit_post",
  description:
    "Submit the generated blog post draft. Call this exactly once with the complete post.",
  input_schema: {
    type: "object",
    required: ["title", "slug", "body_markdown"],
    properties: {
      title: { type: "string", description: "Post title" },
      slug: {
        type: "string",
        description: "URL slug, kebab-case, no leading slash",
      },
      meta_description: { type: "string", description: "<= 160 chars" },
      tags: { type: "array", items: { type: "string" } },
      body_markdown: {
        type: "string",
        description:
          "Full post body in markdown. Do NOT embed image markdown — use image_placements instead.",
      },
      image_placements: {
        type: "array",
        items: {
          type: "object",
          required: ["slot", "after_heading"],
          properties: {
            slot: { type: "integer" },
            after_heading: {
              type: "string",
              description: "Exact H2 heading text the image should follow",
            },
            caption: { type: "string" },
            layout: { type: "string", enum: ["full", "right", "left"] },
          },
        },
      },
    },
  },
} as const;
import { searchPexels } from "@/lib/pexels";
import { loadBlogBuilderSettings } from "@/lib/blog-builder-settings";
import {
  composePostSystemPrompt,
  composePostUserPrompt,
  type PostPromptExistingPost,
  type PostPromptBrand,
} from "@/lib/blog-post-prompt";
import { logExternalError } from "@/lib/error-log";
import { enforceRateLimit } from "@/lib/rate-limit";
import { getPlanUsage } from "@/lib/plan";
import { loadAgent, getDefaultAgent, loadSeedAgent } from "@/lib/agents";

// ---------------------------------------------------------------------------
// Routes + wizard helpers
// ---------------------------------------------------------------------------

const SEEDS = "/app/seeds";
const seedKeywords = (id: string) => `${SEEDS}/${id}/keywords`;
const seedCluster = (id: string) => `${SEEDS}/${id}/cluster`;
const seedSerp = (id: string) => `${SEEDS}/${id}/serp`;
const seedImages = (id: string) => `${SEEDS}/${id}/images`;
const seedGenerate = (id: string) => `${SEEDS}/${id}/generate`;

const PHRASE_MAX = 200;
const TITLE_MAX = 200;

// Wizard step order. wizard_step only ever moves forward (editing an
// earlier step never regresses progress) — bumpSeedStep enforces that.
// Route segments match these keys 1:1. "keywords" = enter starter phrases;
// "cluster" = review the AI-expanded set and accept or regenerate.
const STEP_ORDER = ["keywords", "cluster", "serp", "images", "generate", "done"];

function getString(formData: FormData, key: string, max?: number): string {
  const raw = String(formData.get(key) ?? "").trim();
  if (max && raw.length > max) return raw.slice(0, max);
  return raw;
}

function nullableString(s: string): string | null {
  return s.length === 0 ? null : s;
}

/** Advance the seed to `step` only if it's further than the current step. */
async function bumpSeedStep(seedId: string, step: string): Promise<void> {
  await query(
    `UPDATE blog_seeds
        SET wizard_step = $2, updated_at = NOW()
      WHERE id = $1::bigint
        AND array_position($3::text[], wizard_step)
            < array_position($3::text[], $2)`,
    [seedId, step, STEP_ORDER],
  );
}

/** Redirect to the seeds home unless the seed belongs to this user. */
async function assertSeedOwned(seedId: string, userId: string): Promise<void> {
  const r = await query<{ one: number }>(
    `SELECT 1 AS one FROM blog_seeds
      WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
    [seedId, userId],
  );
  if (r.rows.length === 0) redirect(SEEDS);
}

// ---------------------------------------------------------------------------
// Seed lifecycle
// ---------------------------------------------------------------------------

export async function createSeed(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const title = getString(formData, "title", TITLE_MAX);
  if (!title) redirect(`${SEEDS}?error=invalid-title`);

  // Which agent writes this seed: the chosen one (if it's theirs), else the
  // user's default. May be null if the user has no agents yet.
  const rawAgent = String(formData.get("agentId") ?? "").trim();
  let agentId: string | null = null;
  if (/^\d+$/.test(rawAgent)) {
    const chosen = await loadAgent(rawAgent, me.id);
    if (chosen) agentId = chosen.id;
  }
  if (!agentId) agentId = (await getDefaultAgent(me.id))?.id ?? null;

  const r = await query<{ id: string }>(
    `INSERT INTO blog_seeds (user_id, agent_id, title, wizard_step, status)
     VALUES ($1::bigint, $2, $3, 'keywords', 'draft')
     RETURNING id::text`,
    [me.id, agentId, title],
  );
  const id = r.rows[0]!.id;

  revalidatePath(SEEDS);
  redirect(seedKeywords(id));
}

export async function renameSeed(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const id = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(id)) redirect(SEEDS);
  const title = getString(formData, "title", TITLE_MAX);
  if (!title) redirect(`${seedKeywords(id)}?error=invalid-title`);

  await query(
    `UPDATE blog_seeds SET title = $1, updated_at = NOW()
      WHERE id = $2::bigint AND user_id = $3::bigint`,
    [title, id, me.id],
  );
  revalidatePath(seedKeywords(id));
  redirect(`${seedKeywords(id)}?saved=1`);
}

export async function deleteSeed(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const id = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(id)) redirect(SEEDS);

  await query(
    `DELETE FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint`,
    [id, me.id],
  );
  revalidatePath(SEEDS);
  redirect(`${SEEDS}?saved=1`);
}

/** Wizard "Next" / "Back" navigation — bumps progress then routes. */
export async function advanceWizardStep(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const id = String(formData.get("seedId") ?? "");
  const step = getString(formData, "step");
  if (!/^\d+$/.test(id) || !STEP_ORDER.includes(step)) redirect(SEEDS);
  await assertSeedOwned(id, me.id);
  await bumpSeedStep(id, step);
  redirect(`${SEEDS}/${id}/${step === "done" ? "generate" : step}`);
}

// ---------------------------------------------------------------------------
// Step 1 — Cluster: expand starter keywords into the seed's keyword set
// ---------------------------------------------------------------------------

const CLUSTER_SYSTEM_PROMPT = `You are a senior SEO strategist.

Your job: given one or more seed keywords, output a tight cluster of 8 to 14 closely-related search queries that share the SAME search intent as the seeds, suitable for targeting on a single article.

Rules:
- All queries must share one search intent (one of: informational, commercial, navigational, transactional). Do NOT mix intents.
- Each query is a phrase a real person would type into Google: 3-10 words, lowercase, no punctuation, no quotes.
- Do not repeat the seed keywords verbatim.
- Avoid pure synonyms that would target the same exact page (pick one).
- Prefer phrases that surface long-tail variations: questions, qualifiers, and specific sub-topics.

Output ONLY a single valid JSON object — no prose, no markdown fences. Shape:

{
  "name": "short cluster name (typically the main seed or a tightened version)",
  "intent": "informational" | "commercial" | "navigational" | "transactional",
  "keywords": ["phrase 1", "phrase 2", ...]
}`;

type ClusterPayload = {
  name?: string;
  intent?: string;
  keywords?: string[];
};

const CLUSTER_INTENTS = new Set([
  "informational",
  "commercial",
  "navigational",
  "transactional",
]);

function normalisePhrase(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Split a starter-keyword textarea (newlines and/or commas) into phrases. */
function parseStarters(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const part of raw.split(/[\n,]+/)) {
    const phrase = part.trim();
    if (!phrase || phrase.length > PHRASE_MAX) continue;
    const norm = normalisePhrase(phrase);
    if (!norm || seen.has(norm)) continue;
    seen.add(norm);
    out.push(phrase);
  }
  return out;
}

export async function expandSeedKeywords(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);
  await assertSeedOwned(seedId, me.id);

  const rawStarters = String(formData.get("starters") ?? "");
  const starters = parseStarters(rawStarters);
  if (starters.length === 0) {
    redirect(`${seedKeywords(seedId)}?error=empty-starters`);
  }

  const rl = await enforceRateLimit(me.id, "cluster");
  if (!rl.ok) redirect(`${seedKeywords(seedId)}?error=rate-limited`);

  const userPrompt = [
    "Seed keywords:",
    ...starters.map((s) => `- ${s}`),
    "",
    "Return the JSON cluster now.",
  ].join("\n");

  const settings = await loadBlogBuilderSettings();
  const result = await callClaude({
    system: CLUSTER_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: settings.clusterMaxTokens,
    logMeta: { context: "cluster-expand", userId: me.id, seedId },
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[cluster] AI call failed", result.error);
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "cluster-expand",
      message: result.error,
    });
    redirect(`${seedKeywords(seedId)}?error=service-error`);
  }

  const parsed = extractJson<ClusterPayload>(result.text);
  if (
    !parsed ||
    !Array.isArray(parsed.keywords) ||
    parsed.keywords.length === 0
  ) {
    // eslint-disable-next-line no-console
    console.error("[cluster] Could not parse cluster JSON", result.text.slice(0, 400));
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "cluster-expand",
      message: "Unparseable cluster response",
      detail: result.text.slice(0, 4000),
    });
    redirect(`${seedKeywords(seedId)}?error=service-error`);
  }

  // Clean + dedupe expanded phrases (excluding the starters verbatim).
  const starterNorms = new Set(starters.map(normalisePhrase));
  const seen = new Set<string>(starterNorms);
  const expanded: string[] = [];
  for (const raw of parsed.keywords) {
    if (typeof raw !== "string") continue;
    const norm = normalisePhrase(raw);
    if (!norm || norm.length > PHRASE_MAX) continue;
    if (seen.has(norm)) continue;
    seen.add(norm);
    expanded.push(norm);
  }

  const intent = CLUSTER_INTENTS.has(String(parsed.intent ?? "").toLowerCase())
    ? String(parsed.intent).toLowerCase()
    : null;
  const name =
    typeof parsed.name === "string" && parsed.name.trim().length > 0
      ? parsed.name.trim().slice(0, TITLE_MAX)
      : starters[0];

  await withTransaction(async (client) => {
    // Re-running the expand fully resets the seed's keyword set + cluster.
    await client.query(`DELETE FROM blog_keywords WHERE seed_id = $1::bigint`, [
      seedId,
    ]);
    await client.query(`DELETE FROM blog_clusters WHERE seed_id = $1::bigint`, [
      seedId,
    ]);

    // Starter rows — the first starter is the primary anchor.
    for (let i = 0; i < starters.length; i++) {
      await client.query(
        `INSERT INTO blog_keywords (seed_id, phrase, intent, is_primary, is_starter)
         VALUES ($1::bigint, $2, $3, $4, TRUE)
         ON CONFLICT (seed_id, LOWER(phrase)) DO NOTHING`,
        [seedId, starters[i], intent, i === 0],
      );
    }

    if (expanded.length > 0) {
      await client.query(
        `INSERT INTO blog_keywords (seed_id, phrase, intent, is_primary, is_starter)
         SELECT $1::bigint, phrase, $2, FALSE, FALSE
           FROM unnest($3::text[]) AS phrase
         ON CONFLICT (seed_id, LOWER(phrase)) DO NOTHING`,
        [seedId, intent, expanded],
      );
    }

    await client.query(
      `INSERT INTO blog_clusters (seed_id, name, intent, model_used)
       VALUES ($1::bigint, $2, $3, $4)`,
      [seedId, name, intent, result.ok ? result.model : null],
    );

    await client.query(
      `UPDATE blog_seeds
          SET starter_keywords = $2,
              intent = COALESCE($3, intent),
              model_used = $4,
              status = 'cluster',
              updated_at = NOW()
        WHERE id = $1::bigint`,
      [seedId, rawStarters.trim().slice(0, 4000), intent, result.ok ? result.model : null],
    );
  });

  await bumpSeedStep(seedId, "cluster");

  revalidatePath(seedCluster(seedId));
  redirect(seedCluster(seedId));
}

export async function removeSeedKeyword(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const keywordId = String(formData.get("keywordId") ?? "");
  if (!/^\d+$/.test(seedId) || !/^\d+$/.test(keywordId)) redirect(SEEDS);
  await assertSeedOwned(seedId, me.id);

  const r = await query<{ is_primary: boolean }>(
    `SELECT is_primary FROM blog_keywords
      WHERE id = $1::bigint AND seed_id = $2::bigint LIMIT 1`,
    [keywordId, seedId],
  );
  if (r.rows[0]?.is_primary) {
    redirect(`${seedCluster(seedId)}?error=cant-remove-primary`);
  }

  await query(
    `DELETE FROM blog_keywords
      WHERE id = $1::bigint AND seed_id = $2::bigint AND is_primary = FALSE`,
    [keywordId, seedId],
  );

  revalidatePath(seedCluster(seedId));
  redirect(`${seedCluster(seedId)}?saved=1`);
}

export async function addSeedKeyword(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);
  await assertSeedOwned(seedId, me.id);

  const phrase = getString(formData, "phrase", PHRASE_MAX);
  if (phrase.length < 2) {
    redirect(`${seedCluster(seedId)}?error=invalid-phrase`);
  }

  // Inherit the cluster intent so the new keyword stays on-topic.
  const intentRes = await query<{ intent: string | null }>(
    `SELECT intent FROM blog_clusters WHERE seed_id = $1::bigint LIMIT 1`,
    [seedId],
  );
  const intent = intentRes.rows[0]?.intent ?? null;

  await query(
    `INSERT INTO blog_keywords (seed_id, phrase, intent, is_primary, is_starter)
     VALUES ($1::bigint, $2, $3, FALSE, FALSE)
     ON CONFLICT (seed_id, LOWER(phrase)) DO NOTHING`,
    [seedId, phrase, intent],
  );

  revalidatePath(seedCluster(seedId));
  redirect(`${seedCluster(seedId)}?saved=1`);
}

// ---------------------------------------------------------------------------
// Step 2 — SERP analysis (Claude with web_search + web_fetch tools)
// ---------------------------------------------------------------------------

const SERP_SYSTEM_PROMPT = `You are an SEO research assistant.

You will receive a primary keyword. Use the web_search tool to search Google for that exact phrase. From the results, identify the top 3 ORGANIC ranking pages — skip ads, video carousels, and featured snippets. Use the web_fetch tool to fetch each of the top 3 URLs and read their content.

Then analyze the three pages:
- Format: classify each as one of: listicle, tutorial, guide, comparison, review, mixed
- Length: estimate word count of each
- Topics: list the key topics each page actually covers (5-12 per page)

Compute:
- average_word_count across the three
- target_word_count: a range within ±20% of the average, formatted "X-Y words"
- common_topics: topics covered by ALL three pages
- missing_topics_to_add: 1-2 topics that none of the top 3 cover but that a great article on this keyword should include
- recommended_format: which of the four formats (listicle/tutorial/guide/comparison) the data suggests
- format_rationale: one sentence on why

Return ONLY a single valid JSON object — no prose, no markdown fences. Shape:

{
  "keyword": "...",
  "summary": "1-2 sentence read of the SERP landscape",
  "top_results": [
    {
      "rank": 1,
      "url": "...",
      "title": "...",
      "domain": "...",
      "format": "listicle | tutorial | guide | comparison | review | mixed",
      "estimated_word_count": 0,
      "topics_covered": ["..."]
    },
    { "rank": 2, ... },
    { "rank": 3, ... }
  ],
  "average_word_count": 0,
  "target_word_count": "X-Y words",
  "common_topics": ["..."],
  "missing_topics_to_add": ["..."],
  "recommended_format": "listicle | tutorial | guide | comparison",
  "format_rationale": "..."
}`;

type SerpAnalysis = {
  keyword?: string;
  summary?: string;
  top_results?: Array<{
    rank?: number;
    url?: string;
    title?: string;
    domain?: string;
    format?: string;
    estimated_word_count?: number;
    topics_covered?: string[];
  }>;
  average_word_count?: number;
  target_word_count?: string;
  common_topics?: string[];
  missing_topics_to_add?: string[];
  recommended_format?: string;
  format_rationale?: string;
};

/** Primary keyword phrase for a seed, falling back to the seed title. */
async function loadSeedSearchPhrase(
  seedId: string,
  userId: string,
): Promise<string | null> {
  const r = await query<{ phrase: string | null; title: string }>(
    `SELECT k.phrase AS phrase, s.title AS title
       FROM blog_seeds s
  LEFT JOIN blog_keywords k ON k.seed_id = s.id AND k.is_primary = TRUE
      WHERE s.id = $1::bigint AND s.user_id = $2::bigint LIMIT 1`,
    [seedId, userId],
  );
  const row = r.rows[0];
  if (!row) return null;
  return row.phrase ?? row.title ?? null;
}

export async function runSerpAnalysis(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);

  const phrase = await loadSeedSearchPhrase(seedId, me.id);
  if (!phrase) redirect(SEEDS);

  const rlSerp = await enforceRateLimit(me.id, "serp");
  if (!rlSerp.ok) redirect(`${seedSerp(seedId)}?error=rate-limited`);

  const settings = await loadBlogBuilderSettings();
  const result = await callClaude({
    system: SERP_SYSTEM_PROMPT,
    messages: [
      {
        role: "user",
        content: `Primary keyword: "${phrase}"\n\nRun the analysis now and return the JSON.`,
      },
    ],
    tools: [WEB_SEARCH_TOOL, WEB_FETCH_TOOL],
    maxTokens: settings.serpMaxTokens,
    logMeta: { context: "serp-analysis", userId: me.id, seedId },
  });
  if (!result.ok) {
    // eslint-disable-next-line no-console
    console.error("[serp] AI call failed", result.error);
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "serp-analysis",
      message: result.error,
      detail: `keyword: ${phrase}`,
    });
    redirect(`${seedSerp(seedId)}?error=service-error`);
  }

  const parsed = extractJson<SerpAnalysis>(result.text);
  if (!parsed || !Array.isArray(parsed.top_results)) {
    // eslint-disable-next-line no-console
    console.error("[serp] Could not parse SERP JSON", result.text.slice(0, 500));
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "serp-analysis",
      message: "Unparseable SERP response",
      detail: result.text.slice(0, 4000),
    });
    redirect(`${seedSerp(seedId)}?error=service-error`);
  }

  await query(
    `UPDATE blog_seeds
        SET serp_analysis_json = $2::jsonb,
            serp_analyzed_at = NOW(),
            updated_at = NOW()
      WHERE id = $1::bigint AND user_id = $3::bigint`,
    [seedId, JSON.stringify(parsed), me.id],
  );

  await bumpSeedStep(seedId, "images");

  revalidatePath(seedSerp(seedId));
  redirect(`${seedSerp(seedId)}?saved=1`);
}

export async function clearSerpAnalysis(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);

  await query(
    `UPDATE blog_seeds
        SET serp_analysis_json = NULL,
            serp_analyzed_at = NULL,
            updated_at = NOW()
      WHERE id = $1::bigint AND user_id = $2::bigint`,
    [seedId, me.id],
  );

  revalidatePath(seedSerp(seedId));
  redirect(`${seedSerp(seedId)}?saved=1`);
}

// ---------------------------------------------------------------------------
// Step 3 — Pexels image pool: up to 5 slots per seed, each refreshable.
// ---------------------------------------------------------------------------

const IMAGE_SLOTS = 5;

async function fetchPexelsPage(
  phrase: string,
  page: number,
  redirectKey: string,
  ctx: { userId: string; seedId: string },
): Promise<
  Array<{
    id: number;
    url: string;
    src: { original: string; large2x?: string; large?: string };
    photographer: string;
    photographer_url: string;
    alt: string;
  }>
> {
  const pexels = await searchPexels(phrase, { page, perPage: IMAGE_SLOTS });
  if (!pexels.ok) {
    const code = pexels.error.includes("PEXELS_API_KEY")
      ? "no-pexels-key"
      : "pexels-error";
    // eslint-disable-next-line no-console
    console.error("[pexels] search failed", pexels.error);
    await logExternalError({
      userId: ctx.userId,
      seedId: ctx.seedId,
      source: "pexels",
      context: "image-search",
      message: pexels.error,
      detail: `phrase: ${phrase} · page: ${page}`,
    });
    redirect(`${redirectKey}?error=${code}`);
  }
  // An empty result set is a normal condition (no more photos for the
  // phrase), not an error — don't log it.
  if (pexels.photos.length === 0) {
    redirect(`${redirectKey}?error=no-pexels-results`);
  }
  return pexels.photos;
}

type PexelsPick = {
  id: number;
  url: string;
  src: { original: string; large2x?: string; large?: string };
  photographer: string;
  photographer_url: string;
  alt: string;
};

async function upsertImageSlot(
  seedId: string,
  slot: number,
  page: number,
  pick: PexelsPick,
  altFallback: string,
  searchPhrase: string | null,
): Promise<void> {
  await query(
    `INSERT INTO blog_seed_images
       (seed_id, slot, source, source_id, url_large, url_original,
        source_url, photographer, photographer_url, alt, page_offset,
        include_in_post, search_phrase)
     VALUES ($1::bigint, $2::int, 'pexels', $3, $4, $5, $6, $7, $8, $9, $10,
             COALESCE(
               (SELECT include_in_post FROM blog_seed_images
                  WHERE seed_id = $1::bigint AND slot = $2::int),
               TRUE), $11)
     ON CONFLICT (seed_id, slot) DO UPDATE
       SET source = EXCLUDED.source,
           source_id = EXCLUDED.source_id,
           url_large = EXCLUDED.url_large,
           url_original = EXCLUDED.url_original,
           source_url = EXCLUDED.source_url,
           photographer = EXCLUDED.photographer,
           photographer_url = EXCLUDED.photographer_url,
           alt = EXCLUDED.alt,
           page_offset = EXCLUDED.page_offset,
           updated_at = NOW()`,
    [
      seedId,
      slot,
      String(pick.id),
      pick.src.large2x ?? pick.src.large ?? pick.src.original,
      pick.src.original,
      pick.url,
      pick.photographer,
      pick.photographer_url,
      pick.alt ?? altFallback,
      page,
      searchPhrase,
    ],
  );
}

export async function findInitialImages(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);

  const phrase = await loadSeedSearchPhrase(seedId, me.id);
  if (!phrase) redirect(SEEDS);

  const rlImg = await enforceRateLimit(me.id, "image");
  if (!rlImg.ok) redirect(`${seedImages(seedId)}?error=rate-limited`);

  const photos = await fetchPexelsPage(phrase, 1, seedImages(seedId), {
    userId: me.id,
    seedId,
  });
  for (let i = 0; i < IMAGE_SLOTS && i < photos.length; i++) {
    await upsertImageSlot(seedId, i, 1, photos[i], phrase, null);
  }

  await bumpSeedStep(seedId, "generate");

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

export async function refreshImageSlot(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  if (!/^\d+$/.test(seedId) || !/^\d+$/.test(slotRaw)) redirect(SEEDS);
  const slot = Math.max(0, Number(slotRaw));
  await assertSeedOwned(seedId, me.id);

  const slotRowRes = await query<{ search_phrase: string | null }>(
    `SELECT search_phrase FROM blog_seed_images
      WHERE seed_id = $1::bigint AND slot = $2::int LIMIT 1`,
    [seedId, slot],
  );
  const storedPhrase = slotRowRes.rows[0]?.search_phrase ?? null;
  const phrase = storedPhrase ?? (await loadSeedSearchPhrase(seedId, me.id));
  if (!phrase) redirect(SEEDS);

  const rlRefresh = await enforceRateLimit(me.id, "image");
  if (!rlRefresh.ok) redirect(`${seedImages(seedId)}?error=rate-limited`);

  const existing = await query<{ source_id: string; page_offset: number }>(
    `SELECT source_id, page_offset FROM blog_seed_images
      WHERE seed_id = $1::bigint
        AND COALESCE(search_phrase, '') = COALESCE($2::text, '')`,
    [seedId, storedPhrase],
  );
  const usedIds = new Set(existing.rows.map((r) => r.source_id));
  const maxOffset = existing.rows.reduce((m, r) => Math.max(m, r.page_offset), 0);

  let pick: PexelsPick | null = null;
  let pageUsed = maxOffset + 1;
  for (let attempt = 0; attempt < 3 && !pick; attempt++) {
    const page = maxOffset + 1 + attempt;
    const photos = await fetchPexelsPage(phrase, page, seedImages(seedId), {
      userId: me.id,
      seedId,
    });
    pick = photos.find((p) => !usedIds.has(String(p.id))) ?? null;
    if (pick) pageUsed = page;
  }
  if (!pick) {
    redirect(`${seedImages(seedId)}?error=no-pexels-results`);
  }

  await upsertImageSlot(seedId, slot, pageUsed, pick, phrase, storedPhrase);

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

export async function addCustomKeywordImage(
  formData: FormData,
): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const rawPhrase = String(formData.get("phrase") ?? "").trim();
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);
  if (rawPhrase.length < 2 || rawPhrase.length > PHRASE_MAX) {
    redirect(`${seedImages(seedId)}?error=invalid-phrase`);
  }
  await assertSeedOwned(seedId, me.id);
  const phrase = rawPhrase;

  const rlAdd = await enforceRateLimit(me.id, "image");
  if (!rlAdd.ok) redirect(`${seedImages(seedId)}?error=rate-limited`);

  const maxSlotRes = await query<{ max_slot: number | null }>(
    `SELECT MAX(slot)::int AS max_slot FROM blog_seed_images
      WHERE seed_id = $1::bigint`,
    [seedId],
  );
  const maxSlot = maxSlotRes.rows[0]?.max_slot ?? -1;
  const nextSlot = Math.max(IMAGE_SLOTS, maxSlot + 1);

  const photos = await fetchPexelsPage(phrase, 1, seedImages(seedId), {
    userId: me.id,
    seedId,
  });
  await upsertImageSlot(seedId, nextSlot, 1, photos[0], phrase, phrase);

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

export async function toggleImageInclude(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  if (!/^\d+$/.test(seedId) || !/^\d+$/.test(slotRaw)) redirect(SEEDS);
  const slot = Number(slotRaw);
  await assertSeedOwned(seedId, me.id);

  await query(
    `UPDATE blog_seed_images
        SET include_in_post = NOT include_in_post,
            updated_at = NOW()
      WHERE seed_id = $1::bigint AND slot = $2::int`,
    [seedId, slot],
  );

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

export async function clearImageSlot(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const slotRaw = String(formData.get("slot") ?? "");
  if (!/^\d+$/.test(seedId) || !/^\d+$/.test(slotRaw)) redirect(SEEDS);
  const slot = Number(slotRaw);
  await assertSeedOwned(seedId, me.id);

  await query(
    `DELETE FROM blog_seed_images
      WHERE seed_id = $1::bigint AND slot = $2::int`,
    [seedId, slot],
  );

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

export async function clearAllImages(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);
  await assertSeedOwned(seedId, me.id);

  await query(
    `DELETE FROM blog_seed_images
      WHERE seed_id = $1::bigint AND slot < $2::int`,
    [seedId, IMAGE_SLOTS],
  );

  revalidatePath(seedImages(seedId));
  redirect(`${seedImages(seedId)}?saved=1`);
}

// ---------------------------------------------------------------------------
// Step 4 — Generate a blog instance from the seed
// ---------------------------------------------------------------------------

type ImageLayout = "full" | "right" | "left";

type GeneratedPostJson = {
  title?: string;
  slug?: string;
  meta_description?: string;
  tags?: string[];
  body_markdown?: string;
  image_placements?: Array<{
    slot?: number;
    after_heading?: string;
    caption?: string;
    layout?: string;
  }>;
};

function normalizeLayout(raw: unknown): ImageLayout {
  if (raw === "full" || raw === "right" || raw === "left") return raw;
  return "full";
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
}

type InjectImage = {
  slot: number;
  url_large: string;
  photographer: string | null;
  alt: string | null;
  source_url: string | null;
};

const HERO_MAX_BYTES = 8 * 1024 * 1024;

/** Finalize a generation attempt row (success or error) — best effort. */
async function finalizeAttempt(
  attemptId: string,
  fields: {
    status: "success" | "error";
    responseText: string;
    error: string | null;
    model: string | null;
    postId: string | null;
  },
): Promise<void> {
  try {
    await query(
      `UPDATE blog_generation_attempts
          SET status = $2,
              response_text = $3,
              error = $4,
              model_used = $5,
              post_id = $6::bigint
        WHERE id = $1::bigint`,
      [
        attemptId,
        fields.status,
        fields.responseText,
        fields.error,
        fields.model,
        fields.postId,
      ],
    );
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[post-gen] failed to finalize attempt", e);
  }
}

async function fetchHeroBytes(
  source: { url_large: string } | null,
): Promise<{ mime: string; data: Buffer } | null> {
  if (!source) return null;
  try {
    const res = await fetch(source.url_large);
    if (!res.ok) return null;
    const mime = res.headers.get("content-type") ?? "image/jpeg";
    if (!mime.startsWith("image/")) return null;
    const ab = await res.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > HERO_MAX_BYTES) return null;
    return { mime, data: Buffer.from(ab) };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[post-gen] hero fetch failed (non-fatal)", err);
    return null;
  }
}

function imageHtml(
  img: InjectImage,
  caption: string | undefined,
  layout: ImageLayout,
): string {
  const altText = escapeHtml((caption || img.alt || "").trim());
  const photog = escapeHtml(img.photographer ?? "Pexels");
  const link = escapeHtml(img.source_url ?? "https://www.pexels.com");
  const url = escapeHtml(img.url_large);
  const captionHtml = caption
    ? `${escapeHtml(caption)} — <a href="${link}" target="_blank" rel="noopener">Photo by ${photog} on Pexels</a>`
    : `<a href="${link}" target="_blank" rel="noopener">Photo by ${photog} on Pexels</a>`;
  return [
    "",
    `<figure class="post-image post-image--${layout}">`,
    `  <img src="${url}" alt="${altText}" />`,
    `  <figcaption>${captionHtml}</figcaption>`,
    `</figure>`,
    "",
  ].join("\n");
}

function injectImagesIntoBody(opts: {
  bodyMd: string;
  placements: GeneratedPostJson["image_placements"];
  images: InjectImage[];
}): string {
  const lines = opts.bodyMd.split("\n");
  const imagesBySlot = new Map(opts.images.map((i) => [i.slot, i]));
  const placedSlots = new Set<number>();

  function findHeadingLine(target: string): number {
    const t = target.trim().toLowerCase();
    if (!t) return -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const m = line.match(/^(#{1,6})\s+(.+?)\s*$/);
      if (!m) continue;
      const heading = m[2].toLowerCase().replace(/[.!?:;]+$/, "");
      const tNorm = t.replace(/[.!?:;]+$/, "");
      if (heading === tNorm || heading.includes(tNorm) || tNorm.includes(heading)) {
        return i;
      }
    }
    return -1;
  }

  if (Array.isArray(opts.placements)) {
    for (const p of opts.placements) {
      const slot = p.slot ?? 0;
      if (placedSlots.has(slot)) continue;
      const img = imagesBySlot.get(slot);
      if (!img || !p.after_heading) continue;
      const idx = findHeadingLine(p.after_heading);
      if (idx === -1) continue;
      const layout = normalizeLayout(p.layout);
      lines.splice(idx + 1, 0, imageHtml(img, p.caption, layout));
      placedSlots.add(slot);
    }
  }

  let result = lines.join("\n");
  const unplaced = opts.images.filter((i) => !placedSlots.has(i.slot));
  if (unplaced.length > 0) {
    result = `${result.trimEnd()}\n\n---\n`;
    for (const img of unplaced) {
      result += imageHtml(img, undefined, "full");
    }
  }
  return result;
}

export async function generateSeedInstance(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  if (!/^\d+$/.test(seedId)) redirect(SEEDS);

  // Monthly plan quota: a generated post is the metered/billed unit.
  const usage = await getPlanUsage(me.id, me.plan);
  if (usage.atLimit) redirect(`${seedGenerate(seedId)}?error=quota`);

  const rlPost = await enforceRateLimit(me.id, "post");
  if (!rlPost.ok) redirect(`${seedGenerate(seedId)}?error=rate-limited`);

  const rawInstanceId = String(formData.get("instanceId") ?? "");
  const reuseInstanceId = /^\d+$/.test(rawInstanceId) ? rawInstanceId : null;
  const angle = nullableString(getString(formData, "angle", TITLE_MAX));

  const guardRes = await query<{
    title: string;
    intent: string | null;
    serp_analyzed_at: string | null;
    serp_analysis_json: unknown;
  }>(
    `SELECT title, intent, serp_analyzed_at::text, serp_analysis_json
       FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
    [seedId, me.id],
  );
  const guard = guardRes.rows[0];
  if (!guard) redirect(SEEDS);
  if (!guard.serp_analyzed_at) {
    redirect(`${seedGenerate(seedId)}?error=missing-serp`);
  }

  const [membersRes, imageRes, brand, existingPostsRes, availableTagsRes] =
    await Promise.all([
      query<{ phrase: string; is_primary: boolean }>(
        `SELECT phrase, is_primary
           FROM blog_keywords
          WHERE seed_id = $1::bigint
          ORDER BY is_primary DESC, phrase`,
        [seedId],
      ),
      query<{
        slot: number;
        url_large: string;
        photographer: string | null;
        alt: string | null;
        source_url: string | null;
      }>(
        `SELECT slot, url_large, photographer, alt, source_url
           FROM blog_seed_images
          WHERE seed_id = $1::bigint AND include_in_post = TRUE
          ORDER BY slot`,
        [seedId],
      ),
      // The agent assigned to this seed writes it (falls back to default).
      loadSeedAgent(seedId, me.id),
      // This user's recently published posts so Claude can cross-link.
      query<{ slug: string; title: string; tags: string[] }>(
        `SELECT p.slug,
                p.title,
                COALESCE(
                  ARRAY_AGG(t.label) FILTER (WHERE t.id IS NOT NULL),
                  ARRAY[]::text[]
                ) AS tags
           FROM blog_posts p
      LEFT JOIN blog_post_tags pt ON pt.post_id = p.id
      LEFT JOIN blog_tags t       ON t.id = pt.tag_id
          WHERE p.published_at IS NOT NULL
            AND p.published_at <= NOW()
            AND p.author_id = $1::bigint
          GROUP BY p.id
          ORDER BY p.published_at DESC
          LIMIT 8`,
        [me.id],
      ),
      query<{ id: string; label: string }>(
        `SELECT id::text, label FROM blog_tags ORDER BY sort_order, label`,
      ),
    ]);
  if (imageRes.rows.length === 0) {
    redirect(`${seedGenerate(seedId)}?error=missing-images`);
  }

  // Resolve the instance: re-roll an existing one, or start a new angle.
  let instanceId: string;
  let resolvedAngle: string | null = angle;
  if (reuseInstanceId) {
    const r = await query<{ id: string; angle: string | null }>(
      `SELECT id::text, angle FROM blog_instances
        WHERE id = $1::bigint AND seed_id = $2::bigint LIMIT 1`,
      [reuseInstanceId, seedId],
    );
    if (!r.rows[0]) redirect(seedGenerate(seedId));
    instanceId = r.rows[0].id;
    resolvedAngle = r.rows[0].angle;
  } else {
    const r = await query<{ id: string }>(
      `INSERT INTO blog_instances (seed_id, angle)
       VALUES ($1::bigint, $2)
       RETURNING id::text`,
      [seedId, angle],
    );
    instanceId = r.rows[0]!.id;
  }

  const attemptRes = await query<{ id: string }>(
    `INSERT INTO blog_generation_attempts (instance_id, status)
     VALUES ($1::bigint, 'pending')
     RETURNING id::text`,
    [instanceId],
  );
  const attemptId = attemptRes.rows[0]!.id;

  const brandForPrompt: PostPromptBrand = {
    brandName: brand?.brandName ?? null,
    siteUrl: brand?.siteUrl ?? null,
    audience: brand?.audience ?? null,
    voice: brand?.voice ?? null,
    humour: brand?.humour ?? null,
    perspective: brand?.perspective ?? null,
    stats: brand?.stats ?? null,
    stories: brand?.stories ?? null,
    avoid: brand?.avoid ?? null,
  };

  const existingPosts: PostPromptExistingPost[] = existingPostsRes.rows.map(
    (r) => ({ slug: r.slug, title: r.title, tags: r.tags }),
  );
  const availableTags = availableTagsRes.rows.map((r) => r.label);
  const tagIdsByLowerLabel = new Map(
    availableTagsRes.rows.map((r) => [r.label.toLowerCase(), r.id]),
  );

  const settings = await loadBlogBuilderSettings();
  const systemPrompt = composePostSystemPrompt(brandForPrompt);
  const userPrompt = composePostUserPrompt({
    cluster: { name: guard.title, intent: guard.intent },
    members: membersRes.rows.map((r) => ({
      phrase: r.phrase,
      is_primary: r.is_primary,
    })),
    serp: (guard.serp_analysis_json as never) ?? null,
    images: imageRes.rows.map((r) => ({
      slot: r.slot,
      photographer: r.photographer,
      alt: r.alt,
      source_url: r.source_url,
    })),
    brand: brandForPrompt,
    existingPosts,
    availableTags,
    angle: resolvedAngle,
  });

  const result = await callClaude({
    system: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userPrompt }],
    maxTokens: settings.postMaxTokens,
    tools: [SUBMIT_POST_TOOL],
    toolChoice: { type: "tool", name: "submit_post" },
    logMeta: { context: "post-generation", userId: me.id, seedId },
  });
  if (!result.ok) {
    await finalizeAttempt(attemptId, {
      status: "error",
      responseText: "",
      error: result.error,
      model: null,
      postId: null,
    });
    // eslint-disable-next-line no-console
    console.error("[post-gen] AI call failed", result.error);
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "post-generation",
      message: result.error,
    });
    redirect(`${seedGenerate(seedId)}?error=service-error`);
  }

  const submitCall = result.toolUses.find((t) => t.name === "submit_post");
  const parsed = (submitCall?.input ?? null) as GeneratedPostJson | null;
  const captured = submitCall
    ? `[tool_use submit_post]\n[stop_reason: ${result.stopReason ?? "?"}]\n${JSON.stringify(submitCall.input, null, 2)}`
    : `[stop_reason: ${result.stopReason ?? "?"}]\n${result.text}`;
  if (!parsed || !parsed.title || !parsed.body_markdown) {
    const truncated = result.stopReason === "max_tokens";
    const errMsg = truncated
      ? "Response was truncated by max_tokens before body_markdown completed. Try regenerating — the prompt should target a shorter post now."
      : !submitCall
        ? "submit_post tool was not invoked at all (Claude wrote free text instead)"
        : "submit_post tool was invoked but required fields (title/body_markdown) were missing";
    await finalizeAttempt(attemptId, {
      status: "error",
      responseText: captured,
      error: errMsg,
      model: result.model,
      postId: null,
    });
    // eslint-disable-next-line no-console
    console.error(
      "[post-gen] submit_post incomplete",
      `stop_reason=${result.stopReason ?? "?"}`,
      captured.slice(0, 500),
    );
    await logExternalError({
      userId: me.id,
      seedId,
      source: "anthropic",
      context: "post-generation",
      message: errMsg,
      detail: captured.slice(0, 4000),
    });
    redirect(
      `${seedGenerate(seedId)}?error=${truncated ? "truncated" : "service-error"}`,
    );
  }

  const heroSource = imageRes.rows[0] ?? null;
  const bodyImageRows = heroSource ? imageRes.rows.slice(1) : imageRes.rows;
  const heroBytes = await fetchHeroBytes(heroSource);

  const bodyMd = injectImagesIntoBody({
    bodyMd: String(parsed.body_markdown).trim(),
    placements: parsed.image_placements,
    images: bodyImageRows,
  });

  const baseSlug =
    slugify(parsed.slug ?? "") || slugify(parsed.title) || `seed-${seedId}`;
  const title = String(parsed.title).slice(0, 200);
  const excerpt = parsed.meta_description
    ? String(parsed.meta_description).slice(0, 200)
    : null;

  const postId = await withTransaction(async (client) => {
    let slug = baseSlug;
    let rows: { id: string }[];
    try {
      const r = await client.query<{ id: string }>(
        `INSERT INTO blog_posts (slug, title, excerpt, body_md, author_id, seed_id)
         VALUES ($1, $2, $3, $4, $5::bigint, $6::bigint)
         RETURNING id::text`,
        [slug, title, excerpt, bodyMd, me.id, seedId],
      );
      rows = r.rows;
    } catch (err) {
      if ((err as { code?: string }).code === "23505") {
        slug = `${baseSlug}-${instanceId}`;
        const r = await client.query<{ id: string }>(
          `INSERT INTO blog_posts (slug, title, excerpt, body_md, author_id, seed_id)
           VALUES ($1, $2, $3, $4, $5::bigint, $6::bigint)
           RETURNING id::text`,
          [slug, title, excerpt, bodyMd, me.id, seedId],
        );
        rows = r.rows;
      } else {
        throw err;
      }
    }
    const id = rows[0]!.id;

    if (heroBytes) {
      const imgRes = await client.query<{ id: string }>(
        `INSERT INTO blog_images (post_id, mime_type, bytes, byte_size)
         VALUES ($1::bigint, $2, $3, $4)
         RETURNING id::text`,
        [id, heroBytes.mime, heroBytes.data, heroBytes.data.length],
      );
      await client.query(
        `UPDATE blog_posts SET hero_image_id = $2::bigint, updated_at = NOW()
          WHERE id = $1::bigint`,
        [id, imgRes.rows[0]!.id],
      );
    }

    if (Array.isArray(parsed.tags) && parsed.tags.length > 0) {
      const tagIds = new Set<string>();
      for (const raw of parsed.tags) {
        if (typeof raw !== "string") continue;
        const tid = tagIdsByLowerLabel.get(raw.toLowerCase().trim());
        if (tid) tagIds.add(tid);
      }
      for (const tagId of tagIds) {
        await client.query(
          `INSERT INTO blog_post_tags (post_id, tag_id)
           VALUES ($1::bigint, $2::bigint)
           ON CONFLICT DO NOTHING`,
          [id, tagId],
        );
      }
    }

    // The newest successful attempt becomes the instance's chosen output.
    await client.query(
      `UPDATE blog_instances
          SET generated_post_id = $2::bigint,
              chosen_attempt_id = $3::bigint,
              updated_at = NOW()
        WHERE id = $1::bigint`,
      [instanceId, id, attemptId],
    );
    return id;
  });

  await finalizeAttempt(attemptId, {
    status: "success",
    responseText: captured,
    error: null,
    model: result.model,
    postId,
  });
  await bumpSeedStep(seedId, "done");

  revalidatePath(seedGenerate(seedId));
  revalidatePath(`/app/posts/${postId}/edit`);
  revalidatePath("/app/posts");
  redirect(`/app/posts/${postId}/edit?saved=1&from-seed=${seedId}`);
}

export async function deleteSeedInstance(formData: FormData): Promise<void> {
  const me = await requireUser(SEEDS);
  const seedId = String(formData.get("seedId") ?? "");
  const instanceId = String(formData.get("instanceId") ?? "");
  if (!/^\d+$/.test(seedId) || !/^\d+$/.test(instanceId)) redirect(SEEDS);
  await assertSeedOwned(seedId, me.id);

  // Deleting the instance cascades its attempts; the generated post (if any)
  // is left intact (the FK is ON DELETE SET NULL) so drafts aren't lost.
  await query(
    `DELETE FROM blog_instances
      WHERE id = $1::bigint AND seed_id = $2::bigint`,
    [instanceId, seedId],
  );

  revalidatePath(seedGenerate(seedId));
  // The menubar plan pill (in the root layout) shows monthly post usage,
  // which just changed — refresh the shared layout so it updates too.
  revalidatePath("/", "layout");
  redirect(`${seedGenerate(seedId)}?saved=1`);
}
