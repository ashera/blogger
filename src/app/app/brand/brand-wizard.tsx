"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { BrandProfile, FieldStatus } from "@/lib/brand-score";
import { assessBrand } from "@/lib/brand-score";
import {
  BRAND_SECTIONS,
  type BrandSectionKey,
} from "@/lib/brand-sections";
import {
  saveBrandDraft,
  writeBrandSection,
  type InterviewAnswer,
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

const CHIP: Record<FieldStatus | "optional", { label: string; dot: string; fg: string; bg: string }> = {
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

  const score = useMemo(() => assessBrand(values), [values]);
  const scoredKeys = useMemo(
    () => new Set(score.fields.map((f) => f.key)),
    [score],
  );

  function setField(key: keyof BrandProfile, v: string) {
    setValues((prev) => ({ ...prev, [key]: v }));
  }

  async function persist(): Promise<boolean> {
    setSaving(true);
    setSaveError(null);
    const res = await saveBrandDraft(values);
    setSaving(false);
    if (!res.ok) {
      setSaveError(res.error);
      return false;
    }
    return true;
  }

  async function goTo(target: number) {
    await persist(); // best-effort; state is preserved regardless
    setStep(Math.max(0, Math.min(STEPS.length - 1, target)));
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function finish() {
    const ok = await persist();
    if (ok) router.push("/app");
  }

  const current = STEPS[step]!;
  const isLast = step === STEPS.length - 1;

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 800, margin: "0 auto" }}>
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
            One part at a time. Write each in your own words, or let the AI
            interview you and draft it — you can always edit after.
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
          <div
            style={{
              display: "flex",
              gap: 6,
              marginTop: "var(--s-3)",
              flexWrap: "wrap",
            }}
          >
            {STEPS.map((s, i) => {
              const active = i === step;
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => goTo(i)}
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
                    color: active
                      ? "#fff"
                      : i < step
                        ? "var(--volt-700)"
                        : "var(--ink-3)",
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
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
            <BasicsStep values={values} setField={setField} />
          )}
          {current.kind === "section" && (
            <SectionStep
              sectionKey={current.key}
              value={values[current.key]}
              onChange={(v) => setField(current.key, v)}
              brandName={values.brandName}
              audience={values.audience}
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
                    (s.kind === "basics" && (key === "audience" || key === "brandName")),
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
            disabled={step === 0 || saving}
            onClick={() => goTo(step - 1)}
            style={{ visibility: step === 0 ? "hidden" : "visible" }}
          >
            ← Back
          </button>

          <span style={{ fontSize: 12, color: "var(--ink-3)", minHeight: 16 }}>
            {saving ? "Saving…" : saveError ? "" : "Progress saves automatically"}
            {saveError && (
              <span style={{ color: "var(--danger-700)" }}>{saveError}</span>
            )}
          </span>

          {isLast ? (
            <button
              type="button"
              className="btn --primary"
              disabled={saving}
              onClick={finish}
            >
              {saving ? "Saving…" : "Finish"}
            </button>
          ) : (
            <button
              type="button"
              className="btn --primary"
              disabled={saving}
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
}: {
  values: Values;
  setField: (k: keyof BrandProfile, v: string) => void;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}>
      <div>
        <h2 className="card-heading" style={{ margin: "0 0 4px" }}>
          The basics
        </h2>
        <p className="card-sub" style={{ margin: 0 }}>
          Name your blog, and say who it&rsquo;s for.
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

      <div>
        <span className="field-label" style={{ display: "block" }}>
          {BRAND_SECTIONS.audience.label}
        </span>
        <p
          className="field-help"
          style={{ display: "block", margin: "0 0 8px" }}
        >
          {BRAND_SECTIONS.audience.intro}
        </p>
        <SectionEditor
          sectionKey="audience"
          value={values.audience}
          onChange={(v) => setField("audience", v)}
          brandName={values.brandName}
          audience={values.audience}
        />
      </div>
    </div>
  );
}

function SectionStep({
  sectionKey,
  value,
  onChange,
  brandName,
  audience,
  optional,
}: {
  sectionKey: BrandSectionKey;
  value: string;
  onChange: (v: string) => void;
  brandName: string;
  audience: string;
  optional: boolean;
}) {
  const section = BRAND_SECTIONS[sectionKey];
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
        }}
      >
        <h2 className="card-heading" style={{ margin: 0 }}>
          {section.label}
        </h2>
        {optional && <StatusChip status="optional" />}
      </div>
      <p className="card-sub" style={{ margin: 0 }}>
        {section.intro}
      </p>
      <SectionEditor
        sectionKey={sectionKey}
        value={value}
        onChange={onChange}
        brandName={brandName}
        audience={audience}
      />
    </div>
  );
}

/** Textarea + the "help me write this" AI interview for one section. */
function SectionEditor({
  sectionKey,
  value,
  onChange,
  brandName,
  audience,
}: {
  sectionKey: BrandSectionKey;
  value: string;
  onChange: (v: string) => void;
  brandName: string;
  audience: string;
}) {
  const section = BRAND_SECTIONS[sectionKey];
  const [open, setOpen] = useState(false);
  const [answers, setAnswers] = useState<string[]>(() =>
    section.questions.map(() => ""),
  );
  const [writing, setWriting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function write() {
    setWriting(true);
    setError(null);
    const payload: InterviewAnswer[] = section.questions.map((q, i) => ({
      q,
      a: answers[i] ?? "",
    }));
    const res = await writeBrandSection({
      section: sectionKey,
      answers: payload,
      brandName: brandName.trim() || null,
      audience: audience.trim() || null,
      current: value.trim() || null,
    });
    setWriting(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    onChange(res.text);
    setOpen(false);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--s-2)" }}>
      <textarea
        className="input"
        rows={section.rows}
        maxLength={section.maxLength}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={section.placeholder}
      />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          className="btn --ghost --sm"
          onClick={() => setOpen((o) => !o)}
        >
          {open ? "Close assistant" : "✨ Help me write this"}
        </button>
        <span style={{ fontSize: 11, color: "var(--ink-4)" }}>
          {value.length}/{section.maxLength}
        </span>
      </div>

      {open && (
        <div
          style={{
            marginTop: 4,
            padding: "var(--s-4)",
            background: "var(--surface-sunken)",
            border: "1px solid var(--hairline)",
            borderRadius: 12,
            display: "flex",
            flexDirection: "column",
            gap: "var(--s-3)",
          }}
        >
          <p style={{ margin: 0, fontSize: 13, color: "var(--ink-2)" }}>
            Answer what you can — the AI drafts the section from your answers.
            Skip anything that doesn&rsquo;t apply.
          </p>
          {section.questions.map((q, i) => (
            <label key={i} style={{ display: "block" }}>
              <span
                style={{
                  display: "block",
                  fontSize: 13,
                  fontWeight: 600,
                  color: "var(--ink-1)",
                  marginBottom: 4,
                }}
              >
                {q}
              </span>
              <textarea
                className="input"
                rows={2}
                value={answers[i] ?? ""}
                onChange={(e) =>
                  setAnswers((prev) => {
                    const n = [...prev];
                    n[i] = e.target.value;
                    return n;
                  })
                }
              />
            </label>
          ))}
          {error && (
            <p className="form-error" style={{ margin: 0 }}>
              {error}
            </p>
          )}
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <button
              type="button"
              className="btn --primary --sm"
              onClick={write}
              disabled={writing}
            >
              {writing
                ? "Writing…"
                : value.trim()
                  ? "Rewrite from answers"
                  : "Write it for me"}
            </button>
            <button
              type="button"
              className="btn --ghost --sm"
              onClick={() => setOpen(false)}
              disabled={writing}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
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
  // Order the review the same way the wizard flows.
  const base: Array<{ key: keyof BrandProfile; label: string }> = [
    { key: "audience", label: "Audience" },
    { key: "voice", label: "Voice & tone" },
    { key: "humour", label: "Humour & wit" },
    { key: "perspective", label: "Point of view" },
    { key: "stats", label: "Key facts & stats" },
    { key: "stories", label: "Stories & anecdotes" },
    { key: "avoid", label: "Things to avoid" },
  ];
  const rows: Array<{ key: keyof BrandProfile; label: string; status: FieldStatus | "optional" }> = base.map((r) => {
    const scored = score.fields.find((f) => f.key === r.key);
    const status: FieldStatus | "optional" = scored
      ? scored.status
      : "optional";
    return { ...r, status };
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

      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          gap: 10,
        }}
      >
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

      <ul
        style={{
          listStyle: "none",
          margin: 0,
          padding: 0,
          display: "flex",
          flexDirection: "column",
          gap: 6,
        }}
      >
        {rows.map((r) => {
          const filled = (values[r.key] ?? "").trim().length > 0;
          return (
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
                <span style={{ fontWeight: 600, color: "var(--ink-1)" }}>
                  {r.label}
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {!filled && !scoredKeys.has(r.key) ? null : null}
                  <StatusChip status={r.status} />
                  <span style={{ fontSize: 12, color: "var(--ink-3)" }}>
                    Edit →
                  </span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>

      <p style={{ margin: 0, fontSize: 12.5, color: "var(--ink-3)", lineHeight: 1.5 }}>
        Hit <strong>Finish</strong> to save and head back to your dashboard. You
        can come back and refine any section any time.
      </p>
    </div>
  );
}
