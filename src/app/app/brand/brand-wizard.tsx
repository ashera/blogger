"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandProfile, FieldStatus } from "@/lib/brand-score";
import { assessBrand } from "@/lib/brand-score";
import { BRAND_SECTIONS, type BrandSectionKey } from "@/lib/brand-sections";
import {
  saveBrandDraft,
  generateBrandSections,
} from "@/lib/actions/brand-wizard";

type Values = Record<keyof BrandProfile, string>;

type Step =
  | { kind: "basics" }
  | { kind: "section"; key: BrandSectionKey }
  | { kind: "review" };

const STEPS: Step[] = [
  { kind: "basics" },
  { kind: "section", key: "voice" },
  { kind: "section", key: "humour" },
  { kind: "section", key: "perspective" },
  { kind: "section", key: "stats" },
  { kind: "section", key: "stories" },
  { kind: "section", key: "avoid" },
  { kind: "review" },
];

function stepLabel(s: Step): string {
  if (s.kind === "basics") return "Basics";
  if (s.kind === "review") return "Review";
  return BRAND_SECTIONS[s.key].label;
}

const CHIP: Record<
  FieldStatus | "optional",
  { label: string; dot: string; fg: string; bg: string }
> = {
  good: { label: "Looks good", dot: "var(--ok-500)", fg: "var(--ok-700)", bg: "var(--ok-100)" },
  brief: { label: "Add more", dot: "var(--warn-500)", fg: "var(--warn-700)", bg: "var(--warn-100)" },
  missing: { label: "Missing", dot: "var(--danger-500)", fg: "var(--danger-700)", bg: "var(--danger-100)" },
  optional: { label: "Optional", dot: "var(--ink-4)", fg: "var(--ink-3)", bg: "var(--surface-sunken)" },
};

function StatusChip({ status }: { status: FieldStatus | "optional" }) {
  const m = CHIP[status];
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "2px 9px",
        borderRadius: 999,
        background: m.bg,
        color: m.fg,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.07em",
        textTransform: "uppercase",
        lineHeight: 1.6,
      }}
    >
      <span
        aria-hidden
        style={{ width: 6, height: 6, borderRadius: "50%", background: m.dot, flexShrink: 0 }}
      />
      {m.label}
    </span>
  );
}

export function BrandWizard({ initial }: { initial: BrandProfile }) {
  const router = useRouter();
  const [values, setValues] = useState<Values>(() => ({
    brandName: initial.brandName ?? "",
    siteUrl: initial.siteUrl ?? "",
    audience: initial.audience ?? "",
    voice: initial.voice ?? "",
    humour: initial.humour ?? "",
    perspective: initial.perspective ?? "",
    stats: initial.stats ?? "",
    stories: initial.stories ?? "",
    avoid: initial.avoid ?? "",
  }));
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);

  const score = useMemo(() => assessBrand(values), [values]);
  const scoredKeys = useMemo(() => new Set(score.fields.map((f) => f.key)), [score]);

  function setField(key: keyof BrandProfile, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function persist(override?: Values): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    const res = await saveBrandDraft(override ?? values);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return false;
    }
    return true;
  }

  function scrollTop() {
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function goTo(target: number, override?: Values) {
    await persist(override);
    setStep(Math.max(0, Math.min(STEPS.length - 1, target)));
    scrollTop();
  }

  async function finish() {
    if (await persist()) router.push("/app");
  }

  async function generate() {
    setGenError(null);
    if (!values.brandName.trim() || !values.audience.trim()) {
      setGenError("Add your brand name and audience first so the AI can tailor each section.");
      return;
    }
    setGenerating(true);
    const res = await generateBrandSections({
      brandName: values.brandName,
      siteUrl: values.siteUrl,
      audience: values.audience,
    });
    if (!res.ok) {
      setGenError(res.error);
      setGenerating(false);
      return;
    }
    const merged: Values = { ...values, ...res.sections };
    setValues(merged);
    await persist(merged);
    setGenerating(false);
    setStep(1); // jump to the first generated section (Voice)
    scrollTop();
  }

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;
  const busy = saving || generating;

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 1040, margin: "0 auto" }}>
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
            Set up how BlogSeeder writes for you
          </h1>
          <p style={{ color: "var(--ink-3)", maxWidth: "60ch", margin: 0 }}>
            Tell us your brand, site, and audience — the AI drafts every section
            for you, and you edit each one to make it yours.
          </p>
        </header>

        {/* progress + live score */}
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
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 11,
                letterSpacing: "0.12em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
              }}
            >
              Step {step + 1} of {STEPS.length} · {stepLabel(current)}
            </span>
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              Profile score{" "}
              <strong style={{ color: "var(--ink-1)" }}>{score.percent}%</strong>
            </span>
          </div>
          <div
            style={{
              marginTop: "var(--s-3)",
              height: 6,
              borderRadius: 999,
              background: "var(--surface-sunken)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${(step / (STEPS.length - 1)) * 100}%`,
                height: "100%",
                background: "var(--volt-500)",
                borderRadius: 999,
                transition: "width var(--dur)",
              }}
            />
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: "var(--s-3)", flexWrap: "wrap" }}>
            {STEPS.map((s, i) => {
              const active = i === step;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={busy}
                  title={stepLabel(s)}
                  aria-current={active ? "step" : undefined}
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: "50%",
                    border: active
                      ? "0"
                      : i < step
                        ? "1px solid var(--volt-300)"
                        : "1px solid var(--hairline-strong)",
                    background: active
                      ? "var(--volt-500)"
                      : i < step
                        ? "var(--volt-50)"
                        : "var(--surface)",
                    color: active ? "#fff" : i < step ? "var(--volt-700)" : "var(--ink-3)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: busy ? "default" : "pointer",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* step body */}
        <div className="form-card" style={{ marginBottom: "var(--s-4)" }}>
          {current.kind === "basics" && (
            <BasicsStep
              values={values}
              setField={setField}
              onGenerate={generate}
              generating={generating}
              genError={genError}
              hasGenerated={Boolean(
                values.voice || values.humour || values.perspective,
              )}
            />
          )}
          {current.kind === "section" && (
            <SectionStep
              key={current.key}
              sectionKey={current.key}
              value={values[current.key]}
              onChange={(v) => setField(current.key, v)}
              optional={!scoredKeys.has(current.key)}
            />
          )}
          {current.kind === "review" && (
            <ReviewStep
              score={score}
              scoredKeys={scoredKeys}
              values={values}
              onJump={(key) => {
                const idx = STEPS.findIndex(
                  (s) =>
                    (s.kind === "section" && s.key === key) ||
                    (s.kind === "basics" && key === "audience"),
                );
                if (idx >= 0) goTo(idx);
              }}
            />
          )}
        </div>

        {/* footer nav */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <button
            type="button"
            className="btn --ghost"
            disabled={step === 0 || busy}
            onClick={() => goTo(step - 1)}
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
          >
            ← Back
          </button>

          <span style={{ fontSize: 12, color: "var(--ink-3)", minHeight: 16 }}>
            {saving
              ? "Saving…"
              : saveError
                ? <span style={{ color: "var(--danger-700)" }}>{saveError}</span>
                : "Progress saves automatically"}
          </span>

          {isLast ? (
            <button type="button" className="btn --primary" disabled={busy} onClick={finish}>
              {saving ? "Saving…" : "Finish"}
            </button>
          ) : (
            <button
              type="button"
              className="btn --primary"
              disabled={busy}
              onClick={() => goTo(step + 1)}
            >
              Save &amp; continue →
            </button>
          )}
        </div>
      </main>
    </div>
  );
}

function BasicsStep({
  values,
  setField,
  onGenerate,
  generating,
  genError,
  hasGenerated,
}: {
  values: Values;
  setField: (k: keyof BrandProfile, v: string) => void;
  onGenerate: () => void;
  generating: boolean;
  genError: string | null;
  hasGenerated: boolean;
}) {
  const canGenerate = values.brandName.trim() && values.audience.trim();
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <div>
        <h2 className="card-heading" style={{ margin: "0 0 4px" }}>
          The basics
        </h2>
        <p className="card-sub" style={{ margin: 0 }}>
          Name your blog, add your site, and say who it&rsquo;s for. The AI uses
          these to draft every other section.
        </p>
      </div>
      <div className="grid-2">
        <label className="form-field">
          <span className="field-label">Brand / blog name</span>
          <input
            className="input"
            type="text"
            maxLength={120}
            value={values.brandName}
            onChange={(e) => setField("brandName", e.target.value)}
            placeholder="e.g. Trailhead Coffee Co."
          />
          <span className="field-help">The name these posts are for.</span>
        </label>
        <label className="form-field">
          <span className="field-label">Website URL</span>
          <input
            className="input"
            type="url"
            maxLength={200}
            value={values.siteUrl}
            onChange={(e) => setField("siteUrl", e.target.value)}
            placeholder="https://example.com"
          />
          <span className="field-help">Optional.</span>
        </label>
      </div>

      <label className="form-field">
        <span className="field-label">{BRAND_SECTIONS.audience.label}</span>
        <textarea
          className="input"
          rows={BRAND_SECTIONS.audience.rows}
          maxLength={BRAND_SECTIONS.audience.maxLength}
          value={values.audience}
          onChange={(e) => setField("audience", e.target.value)}
          placeholder={BRAND_SECTIONS.audience.placeholder}
        />
        <span className="field-help">{BRAND_SECTIONS.audience.intro}</span>
      </label>

      {/* generate callout */}
      <div
        style={{
          padding: "var(--s-4)",
          background: "var(--volt-50)",
          border: "1px solid var(--volt-300)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-3)",
        }}
      >
        <div>
          <strong style={{ color: "var(--ink-1)" }}>
            ✨ Draft every section from these details
          </strong>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--ink-2)",
              lineHeight: 1.5,
            }}
          >
            The AI writes your voice, humour, point of view, facts, stories, and
            guardrails — tailored to your brand and audience. You then edit each
            one in the next steps.
            {hasGenerated && (
              <>
                {" "}
                <strong>This replaces the current section text.</strong>
              </>
            )}
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn --primary"
            onClick={onGenerate}
            disabled={generating || !canGenerate}
          >
            {generating
              ? "Writing your profile…"
              : hasGenerated
                ? "Regenerate from these details"
                : "Generate my brand profile"}
          </button>
          {generating ? (
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              Drafting all six sections — this can take a minute or two.
            </span>
          ) : !canGenerate ? (
            <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
              Add a brand name and audience to enable this.
            </span>
          ) : null}
        </div>
        {genError && (
          <p className="form-error" style={{ margin: 0 }}>
            {genError}
          </p>
        )}
      </div>
    </div>
  );
}

function SectionStep({
  sectionKey,
  value,
  onChange,
  optional,
}: {
  sectionKey: BrandSectionKey;
  value: string;
  onChange: (v: string) => void;
  optional: boolean;
}) {
  const section = BRAND_SECTIONS[sectionKey];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h2 className="card-heading" style={{ margin: 0 }}>
          {section.label}
        </h2>
        {optional && <StatusChip status="optional" />}
      </div>
      <p className="card-sub" style={{ margin: 0 }}>
        {section.intro}
      </p>
      <textarea
        className="input"
        rows={section.rows}
        maxLength={section.maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={
          value
            ? section.placeholder
            : `Generate from the first step, or write your own. ${section.placeholder}`
        }
      />
      <div style={{ textAlign: "right", fontSize: 11, color: "var(--ink-4)" }}>
        {value.length}/{section.maxLength}
      </div>
    </div>
  );
}

function ReviewStep({
  score,
  scoredKeys,
  values,
  onJump,
}: {
  score: ReturnType<typeof assessBrand>;
  scoredKeys: Set<keyof BrandProfile>;
  values: Values;
  onJump: (key: keyof BrandProfile) => void;
}) {
  const base: Array<{ key: keyof BrandProfile; label: string }> = [
    { key: "audience", label: "Audience" },
    { key: "voice", label: "Voice & tone" },
    { key: "humour", label: "Humour & wit" },
    { key: "perspective", label: "Point of view" },
    { key: "stats", label: "Key facts & stats" },
    { key: "stories", label: "Stories & anecdotes" },
    { key: "avoid", label: "Things to avoid" },
  ];
  const rows: Array<{ key: keyof BrandProfile; label: string; status: FieldStatus | "optional" }> =
    base.map((r) => {
      const scored = score.fields.find((f) => f.key === r.key);
      return { ...r, status: scored ? scored.status : "optional" };
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <div>
        <h2 className="card-heading" style={{ margin: "0 0 4px" }}>
          Review &amp; finish
        </h2>
        <p className="card-sub" style={{ margin: 0 }}>
          {score.verdict}
        </p>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
        <strong
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 32,
            color: "var(--ink-1)",
            letterSpacing: "-0.02em",
          }}
        >
          {score.percent}%
        </strong>
        <span style={{ color: "var(--ink-3)", fontSize: 13 }}>complete</span>
      </div>

      <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: 6 }}>
        {rows.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              onClick={() => onJump(r.key)}
              style={{
                width: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "var(--s-3)",
                padding: "10px 12px",
                background: "var(--surface-sunken)",
                border: "1px solid var(--hairline)",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
              }}
            >
              <span style={{ fontWeight: 600, color: "var(--ink-1)" }}>{r.label}</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <StatusChip status={r.status} />
                <span style={{ fontSize: 12, color: "var(--ink-3)" }}>Edit →</span>
              </span>
            </button>
          </li>
        ))}
      </ul>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        Hit <strong>Finish</strong> to save and head back to your dashboard. You
        can refine any section any time.
      </p>
    </div>
  );
}
