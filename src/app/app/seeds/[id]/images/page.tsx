import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { proxiedImage } from "@/lib/image-proxy";
import {
  addCustomKeywordImage,
  clearAllImages,
  clearImageSlot,
  findInitialImages,
  refreshImageSlot,
  toggleImageInclude,
} from "@/lib/actions/blog-builder";
import { Button, Field, Input } from "../../../../_components/ui";
import {
  PendingButton,
  SubmitButton,
} from "../../../../_components/submit-button";
import {
  WizardShell,
  WizardNotice,
  WIZARD_ERRORS,
} from "../../../../_components/wizard-steps";

export const dynamic = "force-dynamic";

const IMAGE_SLOTS = 5;

type ImageRow = {
  id: string;
  slot: number;
  include_in_post: boolean;
  source_id: string;
  url_large: string;
  source_url: string | null;
  photographer: string | null;
  photographer_url: string | null;
  alt: string | null;
  search_phrase: string | null;
};

export default async function ImagesStepPage({
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

  const [seedRes, primaryRes, imageRes] = await Promise.all([
    query<{ id: string; title: string; wizard_step: string }>(
      `SELECT id::text, title, wizard_step FROM blog_seeds
        WHERE id = $1::bigint AND user_id = $2::bigint LIMIT 1`,
      [id, me.id],
    ),
    query<{ phrase: string }>(
      `SELECT phrase FROM blog_keywords
        WHERE seed_id = $1::bigint AND is_primary = TRUE LIMIT 1`,
      [id],
    ),
    query<ImageRow>(
      `SELECT id::text, slot, include_in_post, source_id, url_large,
              source_url, photographer, photographer_url, alt, search_phrase
         FROM blog_seed_images WHERE seed_id = $1::bigint ORDER BY slot`,
      [id],
    ),
  ]);
  const seed = seedRes.rows[0];
  if (!seed) notFound();
  const primaryPhrase = primaryRes.rows[0]?.phrase ?? seed.title;

  const imagesBySlot = new Map<number, ImageRow>(
    imageRes.rows.map((r) => [r.slot, r]),
  );
  const slots: Array<ImageRow | null> = Array.from(
    { length: IMAGE_SLOTS },
    (_, i) => imagesBySlot.get(i) ?? null,
  );
  const extras: ImageRow[] = imageRes.rows
    .filter((r) => r.slot >= IMAGE_SLOTS)
    .sort((a, b) => a.slot - b.slot);
  const hasAnyImage = slots.some((s) => s != null);
  const includedCount =
    slots.filter((s) => s?.include_in_post).length +
    extras.filter((e) => e.include_in_post).length;

  return (
    <WizardShell
      seedId={seed.id}
      title={seed.title}
      current="images"
      reached={seed.wizard_step}
    >
      <WizardNotice saved={Boolean(saved)} errorMessage={errorMessage} />

      <section className="form-card" style={{ marginBottom: "var(--s-5)" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            alignItems: "flex-start",
            marginBottom: "var(--s-4)",
          }}
        >
          <div>
            <h2 className="card-heading" style={{ margin: 0 }}>
              Hero images ({includedCount}/{IMAGE_SLOTS} included)
            </h2>
            <p className="card-sub" style={{ marginTop: 4 }}>
              Up to {IMAGE_SLOTS} Pexels candidates, searched against the primary
              keyword (“{primaryPhrase}”). Refresh each slot independently and
              toggle <strong>Include</strong> on the ones the post should use.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <form action={findInitialImages}>
              <input type="hidden" name="seedId" value={seed.id} />
              <SubmitButton
                variant={hasAnyImage ? "ghost" : "primary"}
                pendingLabel="Searching Pexels…"
              >
                {hasAnyImage ? "Re-fill empty slots" : "Find images"}
              </SubmitButton>
            </form>
            {hasAnyImage && (
              <form action={clearAllImages}>
                <input type="hidden" name="seedId" value={seed.id} />
                <Button type="submit" variant="ghost">
                  Clear all
                </Button>
              </form>
            )}
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
            gap: "var(--s-3)",
          }}
        >
          {slots.map((img, slot) => (
            <ImageCard
              key={slot}
              seedId={seed.id}
              slot={slot}
              label={`Slot ${slot + 1}`}
              img={img}
              fallbackAlt={seed.title}
            />
          ))}
        </div>

        {extras.length > 0 && (
          <>
            <hr
              style={{
                border: 0,
                borderTop: "1px dashed var(--hairline)",
                margin: "var(--s-4) 0",
              }}
            />
            <p
              style={{
                margin: "0 0 var(--s-3)",
                fontSize: 12,
                fontFamily: "var(--font-mono)",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Extra images (custom keywords)
            </p>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                gap: "var(--s-3)",
              }}
            >
              {extras.map((img) => (
                <ImageCard
                  key={img.slot}
                  seedId={seed.id}
                  slot={img.slot}
                  label={`“${img.search_phrase ?? "custom"}”`}
                  img={img}
                  fallbackAlt={seed.title}
                />
              ))}
            </div>
          </>
        )}

        <hr
          style={{
            border: 0,
            borderTop: "1px dashed var(--hairline)",
            margin: "var(--s-4) 0",
          }}
        />
        <form
          action={addCustomKeywordImage}
          style={{
            display: "flex",
            gap: "var(--s-2)",
            alignItems: "flex-end",
            flexWrap: "wrap",
          }}
        >
          <input type="hidden" name="seedId" value={seed.id} />
          <Field label="Add an image from another keyword" htmlFor="custom-phrase">
            <Input
              id="custom-phrase"
              name="phrase"
              required
              minLength={2}
              maxLength={200}
              placeholder="e.g. ebike commuter sunrise"
              style={{ minWidth: 280 }}
            />
          </Field>
          <SubmitButton variant="dark" pendingLabel="Searching Pexels…">
            + Add image
          </SubmitButton>
        </form>
      </section>

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "var(--s-3)",
          flexWrap: "wrap",
        }}
      >
        <a href={`/app/seeds/${seed.id}/serp`} className="btn --ghost">
          ← Back: SERP analysis
        </a>
        {includedCount > 0 && (
          <a href={`/app/seeds/${seed.id}/generate`} className="btn --primary">
            Next: Generate →
          </a>
        )}
      </div>
    </WizardShell>
  );
}

function ImageCard({
  seedId,
  slot,
  label,
  img,
  fallbackAlt,
}: {
  seedId: string;
  slot: number;
  label: string;
  img: ImageRow | null;
  fallbackAlt: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: "var(--s-3)",
        background: img?.include_in_post ? "var(--volt-50)" : "var(--surface-sunken)",
        border: `1px solid ${
          img?.include_in_post ? "var(--volt-300)" : "var(--hairline)"
        }`,
        borderRadius: 10,
        opacity: img && !img.include_in_post ? 0.65 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 6,
          fontSize: 11,
          fontFamily: "var(--font-mono)",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: "var(--ink-3)",
        }}
      >
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </span>
        {img?.include_in_post && (
          <span className="users-tag --ok" style={{ fontSize: 10 }}>
            Included
          </span>
        )}
      </div>

      {img ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={proxiedImage(img.url_large)}
            alt={img.alt ?? fallbackAlt}
            style={{
              width: "100%",
              aspectRatio: "16 / 10",
              objectFit: "cover",
              borderRadius: 8,
              background: "var(--surface)",
              display: "block",
            }}
          />
          <div style={{ fontSize: 11, color: "var(--ink-3)", lineHeight: 1.4 }}>
            by{" "}
            {img.photographer_url ? (
              <a
                href={img.photographer_url}
                target="_blank"
                rel="noopener"
                style={{ color: "var(--ink-2)" }}
              >
                {img.photographer}
              </a>
            ) : (
              img.photographer
            )}{" "}
            ·{" "}
            {img.source_url ? (
              <a
                href={img.source_url}
                target="_blank"
                rel="noopener"
                style={{ color: "var(--ink-2)" }}
              >
                Pexels
              </a>
            ) : (
              "Pexels"
            )}
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            <form action={toggleImageInclude}>
              <input type="hidden" name="seedId" value={seedId} />
              <input type="hidden" name="slot" value={slot} />
              <button
                type="submit"
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: img.include_in_post ? "var(--surface)" : "var(--ink-1)",
                  color: img.include_in_post ? "var(--ink-1)" : "var(--paper)",
                  border: "1px solid var(--ink-1)",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                {img.include_in_post ? "Exclude" : "Include"}
              </button>
            </form>
            <form action={refreshImageSlot}>
              <input type="hidden" name="seedId" value={seedId} />
              <input type="hidden" name="slot" value={slot} />
              <PendingButton
                pendingChildren="Refreshing…"
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: "transparent",
                  color: "var(--ink-2)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 999,
                  cursor: "pointer",
                  fontWeight: 600,
                }}
              >
                Refresh
              </PendingButton>
            </form>
            <form action={clearImageSlot}>
              <input type="hidden" name="seedId" value={seedId} />
              <input type="hidden" name="slot" value={slot} />
              <button
                type="submit"
                title="Empty this slot"
                style={{
                  padding: "4px 10px",
                  fontSize: 12,
                  background: "transparent",
                  color: "var(--ink-3)",
                  border: "1px solid var(--hairline)",
                  borderRadius: 999,
                  cursor: "pointer",
                }}
              >
                ✕
              </button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div
            style={{
              width: "100%",
              aspectRatio: "16 / 10",
              border: "1px dashed var(--hairline)",
              borderRadius: 8,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--ink-3)",
              fontSize: 12,
            }}
          >
            Empty
          </div>
          <form action={refreshImageSlot}>
            <input type="hidden" name="seedId" value={seedId} />
            <input type="hidden" name="slot" value={slot} />
            <PendingButton
              pendingChildren="Searching…"
              style={{
                width: "100%",
                padding: "6px 10px",
                fontSize: 12,
                background: "transparent",
                color: "var(--ink-2)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                cursor: "pointer",
                fontWeight: 600,
              }}
            >
              Find a photo
            </PendingButton>
          </form>
        </>
      )}
    </div>
  );
}
