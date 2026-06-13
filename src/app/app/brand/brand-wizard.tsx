"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandProfile, FieldStatus } from "@/lib/brand-score";
import { assessBrand } from "@/lib/brand-score";
import {
  BRAND_SECTIONS,
  GENERATED_SECTIONS,
  type BrandSectionKey,
} from "@/lib/brand-sections";
import {
  saveBrandDraft,
  generateBrandSections,
} from "@/lib/actions/brand-wizard";
import { Modal } from "@/app/_components/modal";
import { WaitingMessage } from "@/app/_components/waiting-quotes";

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
  // Basics snapshot the current sections correspond to. Changing a Basics
  // field (vs this) is what triggers a background regeneration on continue.
  const [genBasics, setGenBasics] = useState(() => ({
    brandName: initial.brandName ?? "",
    siteUrl: initial.siteUrl ?? "",
    audience: initial.audience ?? "",
  }));
  // The user manually edited a generated section this session.
  const [sectionsEdited, setSectionsEdited] = useState(false);
  const [warnOpen, setWarnOpen] = useState(false);

  const score = useMemo(() => assessBrand(values), [values]);
  const scoredKeys = useMemo(() => new Set(score.fields.map((f) => f.key)), [score]);

  function setField(key: keyof BrandProfile, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  function setSection(key: keyof BrandProfile, v: string) {
    setField(key, v);
    setSectionsEdited(true);
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

  const basicsChanged =
    values.brandName.trim() !== genBasics.brandName.trim() ||
    values.siteUrl.trim() !== genBasics.siteUrl.trim() ||
    values.audience.trim() !== genBasics.audience.trim();

  const hasSectionContent = GENERATED_SECTIONS.some(
    (k) => values[k].trim().length > 0,
  );

  /** Generate synchronously, blocking behind the progress dialog. Advances to
   *  the first section on success; shows an error (retry/cancel) on failure. */
  async function runGeneration() {
    if (!values.brandName.trim() || !values.audience.trim()) {
      setGenError("Add your brand name and audience first.");
      return;
    }
    const snap = {
      brandName: values.brandName,
      siteUrl: values.siteUrl,
      audience: values.audience,
    };
    setGenError(null);
    setGenerating(true);
    try {
      const res = await generateBrandSections(snap);
      if (!res.ok) {
        setGenerating(false);
        setGenError(res.error);
        return;
      }
      const merged: Values = { ...values, ...res.sections };
      setGenBasics(snap);
      setSectionsEdited(false);
      setValues(merged);
      await persist(merged);
      setGenerating(false);
      setStep(1);
      scrollTop();
    } catch {
      setGenerating(false);
      setGenError("The AI couldn't generate the profile — please try again.");
    }
  }

  /** Forward from Basics: regenerate when a Basics field changed, warning first
   *  if there's existing section content that would be overwritten. */
  async function leaveBasics() {
    if (!basicsChanged) {
      await goTo(1);
      return;
    }
    if (hasSectionContent) {
      setWarnOpen(true);
      return;
    }
    await persist();
    await runGeneration();
  }

  async function confirmRegenerate() {
    setWarnOpen(false);
    await persist();
    await runGeneration();
  }

  async function keepSections() {
    setWarnOpen(false);
    // Acknowledge the new basics so we don't keep prompting on every continue.
    setGenBasics({
      brandName: values.brandName,
      siteUrl: values.siteUrl,
      audience: values.audience,
    });
    await goTo(1);
  }

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div
      className="page"
      style={{ paddingTop: "var(--s-4)", paddingBottom: "var(--s-3)" }}
    >
      <main style={{ maxWidth: 1040, margin: "0 auto" }}>
        <Link href="/app" className="back-link">
          ← Dashboard
        </Link>

        <header style={{ margin: "var(--s-2) 0 var(--s-3)" }}>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 26,
              color: "var(--ink-1)",
              margin: 0,
              letterSpacing: "-0.02em",
            }}
          >
            Set up how BlogSeeder writes for you
          </h1>
        </header>

        {/* progress + live score — compact: dots double as the progress bar */}
        <div
          className="form-card"
          style={{
            marginBottom: "var(--s-3)",
            padding: "var(--s-3) var(--s-4)",
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "var(--s-3)",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {STEPS.map((s, i) => {
              const active = i === step;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
                  disabled={saving}
                  title={stepLabel(s)}
                  aria-current={active ? "step" : undefined}
                  style={{
                    width: 24,
                    height: 24,
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
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: saving ? "default" : "pointer",
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.1em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            {stepLabel(current)}
          </span>
          <span style={{ marginLeft: "auto", fontSize: 12, color: "var(--ink-3)" }}>
            Score{" "}
            <strong style={{ color: "var(--ink-1)" }}>{score.percent}%</strong>
          </span>
        </div>

        {/* step body */}
        <div className="form-card" style={{ marginBottom: "var(--s-4)" }}>
          {current.kind === "basics" && (
            <BasicsStep
              values={values}
              setField={setField}
              hasSectionContent={hasSectionContent}
            />
          )}
          {current.kind === "section" && (
            <SectionStep
              key={current.key}
              sectionKey={current.key}
              value={values[current.key]}
              onChange={(v) => setSection(current.key, v)}
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

        {/* footer nav — sticky so Save/Continue is always reachable */}
        <div
          style={{
            position: "sticky",
            bottom: 0,
            zIndex: 5,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--s-3)",
            flexWrap: "wrap",
            background: "var(--paper)",
            borderTop: "1px solid var(--hairline)",
            padding: "var(--s-3) 0",
            boxShadow: "0 -6px 16px color-mix(in oklab, var(--ink-1) 6%, transparent)",
          }}
        >
          <button
            type="button"
            className="btn --ghost"
            disabled={step === 0 || saving}
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
            <button type="button" className="btn --primary" disabled={saving} onClick={finish}>
              {saving ? "Saving…" : "Finish"}
            </button>
          ) : (
            <button
              type="button"
              className="btn --primary"
              disabled={saving}
              onClick={() => (step === 0 ? leaveBasics() : goTo(step + 1))}
            >
              Save &amp; continue →
            </button>
          )}
        </div>

        <Modal open={warnOpen} onClose={() => setWarnOpen(false)} maxWidth={520}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              letterSpacing: "-0.01em",
              color: "var(--ink-1)",
              margin: "0 0 var(--s-2)",
            }}
          >
            Regenerate your sections?
          </h2>
          <p style={{ color: "var(--ink-3)", fontSize: 14, lineHeight: 1.5, margin: "0 0 var(--s-4)" }}>
            You changed your basics, and you have section content that may
            include your own edits. Regenerating will{" "}
            <strong>replace every section</strong> with fresh AI drafts from your
            new details. This can&rsquo;t be undone.
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, flexWrap: "wrap" }}>
            <button type="button" className="btn --ghost" onClick={keepSections}>
              Keep my sections
            </button>
            <button type="button" className="btn --primary" onClick={confirmRegenerate}>
              Regenerate sections
            </button>
          </div>
        </Modal>

        <Modal
          open={generating || !!genError}
          onClose={() => setGenError(null)}
          dismissable={!generating}
          maxWidth={460}
          padding="var(--s-7)"
        >
          <div style={{ textAlign: "center" }}>
            {generating ? (
              <WaitingMessage
                title="Writing your brand profile…"
                subtext="This can take a minute or two — please keep this open."
              />
            ) : (
                <>
                  <h2
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: 20,
                      color: "var(--ink-1)",
                      margin: "0 0 var(--s-2)",
                    }}
                  >
                    Couldn&rsquo;t generate
                  </h2>
                  <p style={{ color: "var(--ink-3)", fontSize: 14, margin: "0 0 var(--s-4)", lineHeight: 1.5 }}>
                    {genError}
                  </p>
                  <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
                    <button
                      type="button"
                      className="btn --ghost"
                      onClick={() => setGenError(null)}
                    >
                      Cancel
                    </button>
                    <button type="button" className="btn --primary" onClick={runGeneration}>
                      Try again
                    </button>
                  </div>
                </>
              )}
          </div>
        </Modal>
      </main>
    </div>
  );
}

function BasicsStep({
  values,
  setField,
  hasSectionContent,
}: {
  values: Values;
  setField: (k: keyof BrandProfile, v: string) => void;
  hasSectionContent: boolean;
}) {
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

      <p
        style={{
          margin: 0,
          padding: "var(--s-3) var(--s-4)",
          background: "var(--volt-50)",
          border: "1px solid var(--volt-300)",
          borderRadius: 12,
          fontSize: 13,
          color: "var(--ink-2)",
          lineHeight: 1.5,
        }}
      >
        ✨ When you continue, the AI drafts every section from these details —
        it takes a minute or two, then you edit each one in the next steps.
        {hasSectionContent && (
          <>
            {" "}
            Change a field above and it&rsquo;ll only redraft if you confirm.
          </>
        )}
      </p>
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
            : `Write your own, or change a Basics field to have the AI draft it. ${section.placeholder}`
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
