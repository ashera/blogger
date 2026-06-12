import Link from "next/link";
import { requireUser } from "@/lib/auth";
import {
  loadBrandProfile,
  assessBrand,
  type FieldAssessment,
} from "@/lib/brand-profile";
import { loadBrandExample } from "@/lib/brand-example";
import { saveBrandProfile } from "@/lib/actions/brand-profile";
import { Button, Field, Input } from "../../_components/ui";
import { BrandExampleLoader } from "../../_components/brand-example-loader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand profile" };

/** Compact status chip shown beside a scored field's label — a coloured dot
 *  plus a small caps label, tuned to sit neatly next to the section heading. */
function ScoreBadge({ a }: { a?: FieldAssessment }) {
  const meta = !a
    ? { label: "Optional", dot: "var(--ink-4)", fg: "var(--ink-3)", bg: "var(--surface-sunken)" }
    : a.status === "good"
      ? { label: "Looks good", dot: "var(--ok-500)", fg: "var(--ok-700)", bg: "var(--ok-100)" }
      : a.status === "brief"
        ? { label: "Add more", dot: "var(--warn-500)", fg: "var(--warn-700)", bg: "var(--warn-100)" }
        : { label: "Missing", dot: "var(--danger-500)", fg: "var(--danger-700)", bg: "var(--danger-100)" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 999,
        background: meta.bg,
        color: meta.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        lineHeight: 1.6,
      }}
    >
      <span
        aria-hidden
        style={{
          width: 6,
          height: 6,
          borderRadius: "50%",
          background: meta.dot,
          flexShrink: 0,
        }}
      />
      {meta.label}
    </span>
  );
}

export default async function BrandProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const me = await requireUser("/app/brand");
  const { saved } = await searchParams;
  const [profile, example] = await Promise.all([
    loadBrandProfile(me.id),
    loadBrandExample(),
  ]);
  const brand = assessBrand(profile);
  const byKey = new Map(brand.fields.map((f) => [f.key, f] as const));

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 880, margin: "0 auto" }}>
        <Link href="/app" className="back-link">
          ← Dashboard
        </Link>

        <header style={{ margin: "var(--s-3) 0 var(--s-5)" }}>
          <p className="eyebrow">Brand profile</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--t-h1)",
              color: "var(--ink-1)",
              margin: "var(--s-2) 0 var(--s-3)",
              letterSpacing: "-0.02em",
            }}
          >
            How BlogSeeder writes for you
          </h1>
          <p style={{ color: "var(--ink-3)", maxWidth: "60ch" }}>
            This shapes every post the AI generates — its voice, audience, and
            point of view. Fill in as much as you like; the more you give, the
            more the writing sounds like you and not generic AI prose.
          </p>
        </header>

        {saved && (
          <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
            Brand profile saved.
          </p>
        )}

        <div className="form-card" style={{ marginBottom: "var(--s-4)" }}>
          <div
            style={{
              display: "flex",
              alignItems: "baseline",
              justifyContent: "space-between",
              gap: "var(--s-3)",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <span
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  textTransform: "uppercase",
                  color: "var(--ink-3)",
                }}
              >
                Profile score
              </span>
              <strong
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: 28,
                  color: "var(--ink-1)",
                  letterSpacing: "-0.02em",
                }}
              >
                {brand.percent}%
              </strong>
            </div>
            <p
              style={{
                margin: 0,
                color: "var(--ink-3)",
                fontSize: "var(--t-body-s)",
                maxWidth: "48ch",
              }}
            >
              {brand.verdict}
            </p>
          </div>
          <div
            style={{
              marginTop: "var(--s-3)",
              height: 8,
              borderRadius: 999,
              background: "var(--surface-sunken)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${brand.percent}%`,
                height: "100%",
                background: "var(--volt-500)",
                borderRadius: 999,
              }}
            />
          </div>
          <p
            style={{
              margin: "var(--s-3) 0 0",
              fontSize: 12.5,
              color: "var(--ink-3)",
              lineHeight: 1.45,
            }}
          >
            Each scored section is tagged below — fill the{" "}
            <strong>Missing</strong> and <strong>Add more</strong> ones to reach
            100%. “Optional” sections enrich posts but don&rsquo;t change the
            score.
          </p>
        </div>

        {example && <BrandExampleLoader example={example} />}

        <form
          action={saveBrandProfile}
          className="form-card"
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
        >
          <div className="grid-2">
            <Field
              label="Brand / blog name"
              htmlFor="brand_name"
              help="The name of the site these posts are for."
            >
              <Input
                id="brand_name"
                name="brand_name"
                type="text"
                maxLength={120}
                defaultValue={profile.brandName ?? ""}
                placeholder="e.g. Trailhead Coffee Co."
              />
            </Field>
            <Field
              label="Website URL"
              htmlFor="site_url"
              help="Optional."
            >
              <Input
                id="site_url"
                name="site_url"
                type="url"
                maxLength={200}
                defaultValue={profile.siteUrl ?? ""}
                placeholder="https://example.com"
              />
            </Field>
          </div>

          <Field
            label="Audience"
            htmlFor="audience"
            help="Who you're writing for — their level, goals, and context."
          >
            <textarea
              id="audience"
              name="audience"
              className="input"
              rows={3}
              maxLength={600}
              defaultValue={profile.audience ?? ""}
              placeholder="e.g. Home baristas who want café-quality coffee without pro gear."
            />
          </Field>

          <Field
            label="Voice & tone"
            htmlFor="voice"
            help="How posts should sound — who's writing, sentence rhythm, words to use and avoid, formatting habits, AI tells to dodge. Be comprehensive; examples help a lot. (Room for a full guide.)"
            labelAccessory={<ScoreBadge a={byKey.get("voice")} />}
          >
            <textarea
              id="voice"
              name="voice"
              className="input"
              rows={12}
              maxLength={8000}
              defaultValue={profile.voice ?? ""}
              placeholder="e.g. Friendly and practical, lightly witty, never salesy. Short punchy sentences. Speaks to the reader as 'you'. Avoids jargon unless it explains it."
            />
          </Field>

          <Field
            label="Humour & wit"
            htmlFor="humour"
            help="How the writing makes the reader smile — the kind of humour, how dry, where it lands, and the jokes/clichés to avoid. Kept separate from voice so it gets real weight in every post. Leave blank for straight, no-jokes prose."
            labelAccessory={<ScoreBadge a={byKey.get("humour")} />}
          >
            <textarea
              id="humour"
              name="humour"
              className="input"
              rows={10}
              maxLength={8000}
              defaultValue={profile.humour ?? ""}
              placeholder="e.g. Dry and understated. Land the line and move on — never explain the joke or use exclamation marks. One smirk per section is plenty. No puns, no 'wink wink' asides."
            />
          </Field>

          <Field
            label="Point of view / opinions"
            htmlFor="perspective"
            help="Editorial stances the writer should hold and weave in naturally."
            labelAccessory={<ScoreBadge a={byKey.get("perspective")} />}
          >
            <textarea
              id="perspective"
              name="perspective"
              className="input"
              rows={5}
              maxLength={4000}
              defaultValue={profile.perspective ?? ""}
              placeholder="e.g. We believe freshness beats fancy gear. We're skeptical of single-use pods."
            />
          </Field>

          <Field
            label="Key facts & stats"
            htmlFor="stats"
            help="Numbers, prices, and facts the writer should cite verbatim — never rounded or invented. The writer only uses figures you provide here. Leave blank if posts don't need hard numbers."
            labelAccessory={<ScoreBadge a={byKey.get("stats")} />}
          >
            <textarea
              id="stats"
              name="stats"
              className="input"
              rows={6}
              maxLength={6000}
              defaultValue={profile.stats ?? ""}
              placeholder="e.g. Average wedding-guest dress: $220 retail. Resale recovers 40–60% in the first month. 8 in 10 'barely worn' listings have unpicked bust linings."
            />
          </Field>

          <Field
            label="Stories & anecdotes"
            htmlFor="stories"
            help="Real anecdotes and examples the writer can adapt into posts where they fit. Gives writing lived-in specifics instead of generic filler. Leave blank to skip."
            labelAccessory={<ScoreBadge a={byKey.get("stories")} />}
          >
            <textarea
              id="stories"
              name="stories"
              className="input"
              rows={8}
              maxLength={8000}
              defaultValue={profile.stories ?? ""}
              placeholder="e.g. The 2024 wedding season where three friends each spent $1,200+ on dresses worn once — the origin of the whole resale idea."
            />
          </Field>

          <Field
            label="Things to avoid"
            htmlFor="avoid"
            help="Words, claims, topics, or styles the writer should steer clear of."
            labelAccessory={<ScoreBadge a={byKey.get("avoid")} />}
          >
            <textarea
              id="avoid"
              name="avoid"
              className="input"
              rows={3}
              maxLength={2000}
              defaultValue={profile.avoid ?? ""}
              placeholder="e.g. No hype words ('game-changing'), no medical claims, no competitor bashing."
            />
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" iconRight="check">
              Save brand profile
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
