"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { Modal } from "./modal";

/**
 * Generic 'type DELETE to confirm' destructive-action dialog for the
 * admin console. Mirrors the <dialog> pattern of MarkSoldDialog but
 * adds a typed-confirmation gate (like the account-deletion flow) and
 * an itemised list of exactly what the cascade will erase, so an admin
 * can't fat-finger away a sold listing or a dress's ownership history.
 *
 * `action` is a server action passed down from the (server) page; the
 * form posts the entity id under `idName` and the action redirects
 * back with a ?deleted=… flash.
 */
export function DeleteConfirmDialog({
  deleteAction,
  idName,
  idValue,
  title,
  intro,
  warnings,
  triggerLabel = "Delete",
  confirmWord = "DELETE",
  triggerStyle,
}: {
  deleteAction: (formData: FormData) => void | Promise<void>;
  idName: string;
  idValue: string;
  title: string;
  intro: string;
  /** Bullet list of what the delete cascade will remove. */
  warnings: string[];
  triggerLabel?: string;
  confirmWord?: string;
  /** Override the trigger button styling per placement (table cell vs.
   *  list row). Defaults to a small red-outlined pill. */
  triggerStyle?: CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");

  function openDialog() {
    setOpen(true);
  }
  function closeDialog() {
    setOpen(false);
    setTyped("");
  }

  const armed = typed.trim().toUpperCase() === confirmWord.toUpperCase();

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        style={triggerStyle ?? DEFAULT_TRIGGER_STYLE}
      >
        {triggerLabel}
      </button>

      <Modal open={open} onClose={closeDialog} maxWidth={520} padding="0">
        <form action={deleteAction}>
          <input type="hidden" name={idName} value={idValue} />

          <div style={{ padding: "var(--s-6) var(--s-7)" }}>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 22,
                letterSpacing: "-0.01em",
                lineHeight: 1.2,
                color: "var(--ink-1)",
                margin: "0 0 var(--s-2)",
              }}
            >
              {title}
            </h2>
            <p
              style={{
                color: "var(--ink-3)",
                fontSize: 14,
                lineHeight: 1.5,
                margin: "0 0 var(--s-3)",
              }}
            >
              {intro}
            </p>

            <ul
              style={{
                margin: "0 0 var(--s-4)",
                paddingLeft: 18,
                color: "var(--ink-2)",
                fontSize: 14,
                lineHeight: 1.5,
                display: "flex",
                flexDirection: "column",
                gap: 4,
              }}
            >
              {warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>

            <p
              style={{
                fontSize: 14,
                color: "var(--ink-2)",
                margin: "0 0 var(--s-2)",
              }}
            >
              This can&rsquo;t be undone. Type{" "}
              <strong style={{ fontFamily: "var(--font-mono)" }}>
                {confirmWord}
              </strong>{" "}
              to confirm.
            </p>
            <input
              type="text"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              placeholder={confirmWord}
              aria-label={`Type ${confirmWord} to confirm`}
              className="input"
              style={{ width: "100%", marginBottom: "var(--s-4)" }}
            />

            <div
              style={{
                display: "flex",
                justifyContent: "flex-end",
                gap: 8,
              }}
            >
              <button
                type="button"
                onClick={closeDialog}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  background: "transparent",
                  color: "var(--ink-2)",
                  border: "1px solid var(--hairline-strong)",
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!armed}
                style={{
                  padding: "10px 22px",
                  borderRadius: 999,
                  background: "var(--danger-500)",
                  color: "#fff",
                  border: 0,
                  fontWeight: 600,
                  fontSize: 14,
                  cursor: armed ? "pointer" : "not-allowed",
                  opacity: armed ? 1 : 0.5,
                }}
              >
                {triggerLabel}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </>
  );
}

const DEFAULT_TRIGGER_STYLE: CSSProperties = {
  padding: "6px 14px",
  borderRadius: 999,
  background: "transparent",
  color: "var(--danger-700)",
  border: "1px solid var(--danger-500)",
  fontWeight: 600,
  fontSize: 13,
  cursor: "pointer",
  lineHeight: 1.4,
  whiteSpace: "nowrap",
};
