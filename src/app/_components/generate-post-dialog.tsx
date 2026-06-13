"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Modal } from "./modal";
import { WaitingMessage } from "./waiting-quotes";

type Props = {
  systemPrompt: string;
  userPrompt: string;
  disabled: boolean;
  disabledReason?: string;
  seedId: string;
  // When set, re-roll an existing instance instead of starting a new angle.
  instanceId?: string;
  // When true (new instances), the confirm step asks for an optional angle.
  askAngle?: boolean;
  label?: string;
  generateAction: (formData: FormData) => Promise<void>;
};

export function GeneratePostDialog({
  systemPrompt,
  userPrompt,
  disabled,
  disabledReason,
  seedId,
  instanceId,
  askAngle,
  label,
  generateAction,
}: Props) {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"preview" | "confirm">("preview");
  const [copied, setCopied] = useState<"system" | "user" | "both" | null>(null);

  function openDialog() {
    setStage("preview");
    setCopied(null);
    setOpen(true);
  }
  function close() {
    setOpen(false);
    setCopied(null);
    setStage("preview");
  }
  async function copy(text: string, which: "system" | "user" | "both") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(which);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      // clipboard blocked — silent
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        disabled={disabled}
        title={disabled ? disabledReason : "Preview the prompt"}
        className="btn --primary"
      >
        {label ?? "Generate Post"}
      </button>

      <Modal open={open} onClose={close} maxWidth={880} padding="0">
        {stage === "preview" ? (
          <PreviewView
            systemPrompt={systemPrompt}
            userPrompt={userPrompt}
            copied={copied}
            onCopy={copy}
            onClose={close}
            onContinue={() => setStage("confirm")}
          />
        ) : (
          <ConfirmForm
            seedId={seedId}
            instanceId={instanceId}
            askAngle={askAngle}
            generateAction={generateAction}
            onBack={() => setStage("preview")}
            onClose={close}
          />
        )}
      </Modal>
    </>
  );
}

// ---------------------------------------------------------------------------
// Stage 1 — preview the prompt before any send
// ---------------------------------------------------------------------------

function PreviewView({
  systemPrompt,
  userPrompt,
  copied,
  onCopy,
  onClose,
  onContinue,
}: {
  systemPrompt: string;
  userPrompt: string;
  copied: "system" | "user" | "both" | null;
  onCopy: (text: string, which: "system" | "user" | "both") => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh",
      }}
    >
      <header
        style={{
          padding: "var(--s-4) var(--s-5)",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-3)",
            }}
          >
            Step 1 of 2 · Prompt preview
          </p>
          <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>
            Review what will be sent to the AI writer
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              color: "var(--ink-3)",
              fontSize: 13,
            }}
          >
            Skim the prompt before kicking off the generation. The
            generation itself takes ~30–60 seconds and costs a few cents.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: 0,
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            color: "var(--ink-3)",
            padding: 4,
          }}
        >
          ×
        </button>
      </header>

      <div
        style={{
          padding: "var(--s-4) var(--s-5)",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "var(--s-4)",
        }}
      >
        <PromptBlock
          title="System prompt"
          body={systemPrompt}
          onCopy={() => onCopy(systemPrompt, "system")}
          copied={copied === "system"}
        />
        <PromptBlock
          title="User prompt"
          body={userPrompt}
          onCopy={() => onCopy(userPrompt, "user")}
          copied={copied === "user"}
        />
      </div>

      <footer
        style={{
          padding: "var(--s-3) var(--s-5)",
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          gap: "var(--s-2)",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface-sunken)",
          flexWrap: "wrap",
        }}
      >
        <button
          type="button"
          onClick={() =>
            onCopy(`SYSTEM:\n${systemPrompt}\n\nUSER:\n${userPrompt}`, "both")
          }
          className="btn --ghost"
        >
          {copied === "both" ? "Copied!" : "Copy both"}
        </button>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <button type="button" onClick={onClose} className="btn --ghost">
            Cancel
          </button>
          <button type="button" onClick={onContinue} className="btn --primary">
            Looks good — continue →
          </button>
        </div>
      </footer>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stage 2 — explicit confirm + form submission to the server action
// ---------------------------------------------------------------------------

function ConfirmForm({
  seedId,
  instanceId,
  askAngle,
  generateAction,
  onBack,
  onClose,
}: {
  seedId: string;
  instanceId?: string;
  askAngle?: boolean;
  generateAction: (formData: FormData) => Promise<void>;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <form
      action={generateAction}
      style={{
        display: "flex",
        flexDirection: "column",
        maxHeight: "85vh",
      }}
    >
      <input type="hidden" name="seedId" value={seedId} />
      {instanceId && (
        <input type="hidden" name="instanceId" value={instanceId} />
      )}
      <ConfirmContent askAngle={askAngle} onBack={onBack} onClose={onClose} />
    </form>
  );
}

function ConfirmContent({
  askAngle,
  onBack,
  onClose,
}: {
  askAngle?: boolean;
  onBack: () => void;
  onClose: () => void;
}) {
  const { pending } = useFormStatus();

  if (pending) {
    return (
      <div style={{ padding: "var(--s-8) var(--s-5)" }}>
        <WaitingMessage
          title="Generating draft post…"
          subtext="Don't close this tab — this usually takes 30–60 seconds."
        />
      </div>
    );
  }

  return (
    <>
      <header
        style={{
          padding: "var(--s-4) var(--s-5)",
          borderBottom: "1px solid var(--hairline)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          gap: "var(--s-3)",
        }}
      >
        <div>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              fontFamily: "var(--font-mono)",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              color: "var(--ink-3)",
            }}
          >
            Step 2 of 2 · Confirm
          </p>
          <h3 style={{ margin: "4px 0 0", fontSize: 18 }}>
            Generate the post?
          </h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          style={{
            background: "transparent",
            border: 0,
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            color: "var(--ink-3)",
            padding: 4,
          }}
        >
          ×
        </button>
      </header>

      <div style={{ padding: "var(--s-5)" }}>
        {askAngle && (
          <div style={{ marginBottom: "var(--s-4)" }}>
            <label
              htmlFor="angle"
              className="field-label"
              style={{ display: "block", marginBottom: 6 }}
            >
              Angle / focus <span style={{ color: "var(--ink-3)" }}>(optional)</span>
            </label>
            <input
              id="angle"
              name="angle"
              maxLength={200}
              placeholder="e.g. for first-time buyers on a budget"
              className="input"
              style={{ width: "100%" }}
            />
            <p style={{ margin: "6px 0 0", fontSize: 12, color: "var(--ink-3)" }}>
              Give this instance a distinct angle so it differs from other posts
              generated off this seed. Leave blank for a general take.
            </p>
          </div>
        )}
        <p style={{ margin: "0 0 var(--s-3)", color: "var(--ink-1)" }}>
          This will:
        </p>
        <ul
          style={{
            margin: 0,
            paddingLeft: 20,
            color: "var(--ink-2)",
            fontSize: 14,
            lineHeight: 1.6,
          }}
        >
          <li>Send the brief above to the AI writer (~30–60 seconds).</li>
          <li>
            Create a new <strong>draft</strong> blog post (not published) as an
            instance of this seed.
          </li>
          <li>Drop you on the draft&rsquo;s edit page to review and publish.</li>
        </ul>
        <p
          style={{
            marginTop: "var(--s-4)",
            marginBottom: 0,
            color: "var(--ink-3)",
            fontSize: 13,
          }}
        >
          Want to try a different draft later? Delete the post on its edit
          page and the Generate button on this cluster unlocks again.
        </p>
      </div>

      <footer
        style={{
          padding: "var(--s-3) var(--s-5)",
          borderTop: "1px solid var(--hairline)",
          display: "flex",
          gap: "var(--s-2)",
          justifyContent: "space-between",
          alignItems: "center",
          background: "var(--surface-sunken)",
        }}
      >
        <button type="button" onClick={onBack} className="btn --ghost">
          ← Back to prompt
        </button>
        <div style={{ display: "flex", gap: "var(--s-2)" }}>
          <button type="button" onClick={onClose} className="btn --ghost">
            Cancel
          </button>
          <button type="submit" className="btn --primary">
            Yes, generate it
          </button>
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Shared bits
// ---------------------------------------------------------------------------

function PromptBlock({
  title,
  body,
  onCopy,
  copied,
}: {
  title: string;
  body: string;
  onCopy: () => void;
  copied: boolean;
}) {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 6,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 11,
            fontFamily: "var(--font-mono)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            color: "var(--ink-3)",
          }}
        >
          {title}
        </h4>
        <button
          type="button"
          onClick={onCopy}
          style={{
            background: "transparent",
            border: "1px solid var(--hairline)",
            borderRadius: 999,
            padding: "2px 10px",
            fontSize: 11,
            color: "var(--ink-2)",
            cursor: "pointer",
            fontWeight: 600,
          }}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <pre
        style={{
          margin: 0,
          padding: "var(--s-3)",
          background: "var(--surface-sunken)",
          border: "1px solid var(--hairline)",
          borderRadius: 8,
          fontSize: 12,
          fontFamily: "var(--font-mono)",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          lineHeight: 1.5,
          color: "var(--ink-2)",
        }}
      >
        {body}
      </pre>
    </div>
  );
}

