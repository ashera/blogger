import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { loadBrandProfile } from "@/lib/brand-profile";
import { loadBrandExample } from "@/lib/brand-example";
import { saveBrandProfile } from "@/lib/actions/brand-profile";
import { Button, Field, Input } from "../../_components/ui";
import { BrandExampleLoader } from "../../_components/brand-example-loader";

export const dynamic = "force-dynamic";
export const metadata = { title: "Brand profile" };

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
            How blogger writes for you
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
            <Field label="Website URL" htmlFor="site_url" help="Optional.">
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
