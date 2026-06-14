import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  deleteSeedInstance,
  generateSeedInstance,
} from "@/lib/actions/blog-builder";
import { GeneratePostDialog } from "../../../../_components/generate-post-dialog";
import { LocalTime } from "@/app/_components/local-time";
import {
  WizardShell,
  WizardNotice,
  WIZARD_ERRORS,
} from "../../../../_components/wizard-steps";
import {
  composePostSystemPrompt,
  composePostUserPrompt,
  type PostPromptBrand,
} from "@/lib/blog-post-prompt";
import { loadBrandProfile } from "@/lib/brand-profile";

export const dynamic = "force-dynamic";

type SeedRow = {
  id: string;
  title: string;
  intent: string | null;
  wizard_step: string;
  serp_analyzed_at: string | null;
  serp_analysis_json: unknown;
};

type InstanceRow = {
  id: string;
  angle: string | null;
  generated_post_id: string | null;
  created_at: string;
  post_title: string | null;
  post_published: string | null;
  attempt_count: number;
  last_status: string | null;
  last_error: string | null;
};


export default async function GenerateStepPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireUser();
  const { id } = await params;
  const { saved, error } = await searchParams;
  if (!/^\d+$/.test(id)) notFound();
  const errorMessage = error
    ? WIZARD_ERRORS[error] ?? "Something went wrong."
    : null;

  const [
    seedRes,
    membersRes,
    imageRes,
    brandProfile,
    existingPostsRes,
    availableTagsRes,
    instancesRes,
  ] = await Promise.all([
    query<SeedRow>(
      `SELECT id::text, title, intent, wizard_step,
              serp_analyzed_at::text, serp_analysis_json
         FROM blog_seeds WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [id, me.id],
    ),
    query<{ phrase: string; is_primary: boolean }>(
      `SELECT phrase, is_primary FROM blog_keywords
        WHERE seed_id = $1::bigint ORDER BY is_primary DESC, phrase`,
      [id],
    ),
    query<{
      slot: number;
      photographer: string | null;
      alt: string | null;
      source_url: string | null;
    }>(
      `SELECT slot, photographer, alt, source_url
         FROM blog_seed_images
        WHERE seed_id = $1::bigint AND include_in_post = TRUE
        ORDER BY slot`,
      [id],
    ),
    loadBrandProfile(me.id),
    query<{ slug: string; title: string; tags: string[] }>(
      `SELECT p.slug, p.title,
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
    query<{ label: string }>(
      `SELECT label FROM blog_tags ORDER BY sort_order, label`,
    ),
    query<InstanceRow>(
      `SELECT i.id::text,
              i.angle,
              i.generated_post_id::text,
              i.created_at::text,
              p.title AS post_title,
              p.published_at::text AS post_published,
              (SELECT COUNT(*) FROM blog_generation_attempts a
                 WHERE a.instance_id = i.id)::int AS attempt_count,
              (SELECT a.status FROM blog_generation_attempts a
                 WHERE a.instance_id = i.id
                 ORDER BY a.created_at DESC LIMIT 1) AS last_status,
              (SELECT a.error FROM blog_generation_attempts a
                 WHERE a.instance_id = i.id
                 ORDER BY a.created_at DESC LIMIT 1) AS last_error
         FROM blog_instances i
    LEFT JOIN blog_posts p ON p.id = i.generated_post_id
        WHERE i.seed_id = $1::bigint
        ORDER BY i.created_at DESC`,
      [id],
    ),
  ]);
  const seed = seedRes.rows[0];
  if (!seed) notFound();

  const members = membersRes.rows;
  const includedImages = imageRes.rows;
  const serpDone = Boolean(seed.serp_analyzed_at);
  const imagesDone = includedImages.length > 0;
  const canGenerate = serpDone && imagesDone;
  const instances = instancesRes.rows;

  const brand: PostPromptBrand = {
    brandName: brandProfile.brandName,
    siteUrl: brandProfile.siteUrl,
    audience: brandProfile.audience,
    voice: brandProfile.voice,
    humour: brandProfile.humour,
    perspective: brandProfile.perspective,
    stats: brandProfile.stats,
    stories: brandProfile.stories,
    avoid: brandProfile.avoid,
  };
  const systemPrompt = composePostSystemPrompt(brand);
  const userPrompt = composePostUserPrompt({
    cluster: { name: seed.title, intent: seed.intent },
    members: members.map((m) => ({ phrase: m.phrase, is_primary: m.is_primary })),
    serp: (seed.serp_analysis_json as never) ?? null,
    images: includedImages.map((i) => ({
      slot: i.slot,
      photographer: i.photographer,
      alt: i.alt,
      source_url: i.source_url,
    })),
    brand,
    existingPosts: existingPostsRes.rows,
    availableTags: availableTagsRes.rows.map((r) => r.label),
  });

  const gateReason = !serpDone
    ? "Run SERP analysis first."
    : !imagesDone
      ? "Include at least one hero image first."
      : "";

  return (
    <WizardShell
      seedId={seed.id}
      title={seed.title}
      current="generate"
      reached={seed.wizard_step}
    >
      <WizardNotice saved={Boolean(saved)} errorMessage={errorMessage} />

      <section
        className="form-card"
        style={{
          marginBottom: "var(--s-5)",
          background: canGenerate ? "var(--volt-50)" : undefined,
          border: canGenerate ? "1px solid var(--volt-300)" : undefined,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            alignItems: "flex-start",
          }}
        >
          <div>
            <h2 className="card-heading" style={{ margin: 0 }}>
              Generate a blog instance
            </h2>
            <p className="card-sub" style={{ marginTop: 4 }}>
              Each instance is a distinct post off this seed, sharing the same
              keywords, SERP research, and image pool. Give it an angle to make
              it different from the others. Generation takes ~30–60 seconds and
              costs a few cents.
            </p>
          </div>
          <GeneratePostDialog
            disabled={!canGenerate}
            disabledReason={gateReason}
            systemPrompt={systemPrompt}
            userPrompt={userPrompt}
            seedId={seed.id}
            askAngle
            label="+ New instance"
            generateAction={generateSeedInstance}
          />
        </div>
        {!canGenerate && (
          <p
            style={{
              margin: "var(--s-3) 0 0",
              color: "var(--ink-3)",
              fontSize: "var(--t-body-s)",
            }}
          >
            {gateReason}
          </p>
        )}
      </section>

      <section className="form-card">
        <h2 className="card-heading">
          Blog instances ({instances.length})
        </h2>
        <p className="card-sub">
          Re-roll an instance to try another draft for the same angle — each
          attempt is kept in its history. The latest successful attempt is the
          one linked below.
        </p>

        {instances.length === 0 ? (
          <p style={{ color: "var(--ink-3)", margin: 0 }}>
            No instances yet. Generate your first one above.
          </p>
        ) : (
          <ul
            style={{
              listStyle: "none",
              padding: 0,
              margin: 0,
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            {instances.map((inst) => {
              const failed =
                inst.last_status === "error" && !inst.generated_post_id;
              return (
                <li
                  key={inst.id}
                  style={{
                    padding: "var(--s-3) var(--s-4)",
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 10,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      gap: "var(--s-3)",
                      flexWrap: "wrap",
                      alignItems: "flex-start",
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "var(--ink-1)" }}>
                        {inst.post_title ?? inst.angle ?? "Untitled instance"}
                        {inst.post_published && (
                          <span
                            className="users-tag --ok"
                            style={{ marginLeft: 8 }}
                          >
                            Published
                          </span>
                        )}
                      </div>
                      <div
                        style={{
                          fontSize: 12,
                          color: "var(--ink-3)",
                          marginTop: 2,
                        }}
                      >
                        {inst.angle ? `Angle: ${inst.angle} · ` : ""}
                        {inst.attempt_count}{" "}
                        {inst.attempt_count === 1 ? "attempt" : "attempts"} ·
                        created <LocalTime iso={inst.created_at} />
                      </div>
                      {failed && inst.last_error && (
                        <p
                          style={{
                            margin: "6px 0 0",
                            fontSize: 12,
                            color: "var(--danger-700)",
                          }}
                        >
                          Last attempt failed: {inst.last_error}
                        </p>
                      )}
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: 8,
                        alignItems: "center",
                        flexWrap: "wrap",
                      }}
                    >
                      {inst.generated_post_id && (
                        <Link
                          href={`/app/posts/${inst.generated_post_id}/edit`}
                          className="btn --ghost --sm"
                        >
                          View draft →
                        </Link>
                      )}
                      <GeneratePostDialog
                        disabled={!canGenerate}
                        disabledReason={gateReason}
                        systemPrompt={systemPrompt}
                        userPrompt={userPrompt}
                        seedId={seed.id}
                        instanceId={inst.id}
                        label="Re-roll"
                        generateAction={generateSeedInstance}
                      />
                      <form action={deleteSeedInstance}>
                        <input type="hidden" name="seedId" value={seed.id} />
                        <input type="hidden" name="instanceId" value={inst.id} />
                        <button
                          type="submit"
                          title="Delete this instance (keeps any generated draft)"
                          style={{
                            background: "transparent",
                            border: "1px solid var(--hairline)",
                            color: "var(--ink-3)",
                            padding: "6px 12px",
                            borderRadius: 999,
                            fontSize: 13,
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </form>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div
        style={{
          marginTop: "var(--s-5)",
          display: "flex",
          justifyContent: "flex-start",
        }}
      >
        <a href={`/app/seeds/${seed.id}/images`} className="btn --ghost">
          ← Back: Images
        </a>
      </div>
    </WizardShell>
  );
}
