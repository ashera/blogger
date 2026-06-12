"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getPostExport, type PostExport } from "@/lib/actions/blog-export";

type Status = "idle" | "loading" | "ready" | "error";
type Format = "rich" | "html" | "markdown";

/**
 * "Copy to your website" — lets a post owner copy the post in three formats
 * (rich text for WYSIWYG editors, raw HTML, or Markdown) to paste into their
 * own site. Content is fetched on first open via the getPostExport action and
 * cached for the lifetime of the component. Used on the edit page header and
 * each posts-list row.
 */
export function CopyToSiteButton({
  postId,
  triggerLabel = "Copy to site",
  triggerClassName = "btn --ghost",
  triggerStyle,
}: {
  postId: string;
  triggerLabel?: string;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [data, setData] = useState<PostExport | null>(null);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<Format | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => setCopied(null);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  async function open() {
    dialogRef.current?.showModal();
    if (status === "ready" || status === "loading") return;
    setStatus("loading");
    setError("");
    const res = await getPostExport(postId);
    if (res.ok) {
      setData(res.data);
      setStatus("ready");
    } else {
      setError(res.error);
      setStatus("error");
    }
  }

  function flash(which: Format) {
    setCopied(which);
    window.setTimeout(
      () => setCopied((c) => (c === which ? null : c)),
      1800,
    );
  }

  async function copyPlain(text: string, which: Format) {
    try {
      await navigator.clipboard.writeText(text);
      flash(which);
    } catch {
      setError("Your browser blocked clipboard access.");
    }
  }

  async function copyRich() {
    if (!data) return;
    try {
      if (typeof ClipboardItem !== "undefined" && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/html": new Blob([data.html], { type: "text/html" }),
            "text/plain": new Blob([data.markdown], { type: "text/plain" }),
          }),
        ]);
      } else {
        // Fallback: plain HTML source if rich copy is unsupported.
        await navigator.clipboard.writeText(data.html);
      }
      flash("rich");
    } catch {
      setError("Your browser blocked clipboard access.");
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={open}
        className={triggerClassName}
        style={triggerStyle}
      >
        {triggerLabel}
      </button>

      <dialog
        ref={dialogRef}
        onClick={(e) => {
          if (e.target === dialogRef.current) dialogRef.current?.close();
        }}
        style={{
          padding: 0,
          border: 0,
          borderRadius: 14,
          maxWidth: 540,
          width: "calc(100% - 32px)",
          background: "var(--surface)",
          color: "var(--ink-1)",
          boxShadow: "var(--e-4)",
        }}
      >
        <div style={{ padding: "var(--s-6) var(--s-7)" }}>
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 22,
              letterSpacing: "-0.01em",
              lineHeight: 1.2,
              margin: "0 0 var(--s-2)",
            }}
          >
            Copy to your website
          </h2>
          <p
            style={{
              color: "var(--ink-3)",
              fontSize: 14,
              lineHeight: 1.5,
              margin: "0 0 var(--s-5)",
            }}
          >
            Pick the format your site editor understands, paste it in, and
            publish.
          </p>

          {status === "loading" && (
            <p style={{ color: "var(--ink-3)", fontSize: 14 }}>Preparing…</p>
          )}

          {status === "error" && (
            <p className="form-error" style={{ margin: 0 }}>
              {error}
            </p>
          )}

          {status === "ready" && data && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "var(--s-3)" }}
            >
              <CopyOption
                title="Rich text"
                desc="For visual editors — WordPress block editor, Medium, Notion. Pastes with formatting and images intact."
                recommended
                copied={copied === "rich"}
                onClick={copyRich}
              />
              <CopyOption
                title="HTML"
                desc="For a CMS's code / “custom HTML” view, or a hand-built site."
                copied={copied === "html"}
                onClick={() => copyPlain(data.html, "html")}
              />
              <CopyOption
                title="Markdown"
                desc="For Ghost, Hugo, Jekyll, or any Markdown editor."
                copied={copied === "markdown"}
                onClick={() => copyPlain(data.markdown, "markdown")}
              />

              {data.hasHostedImage && (
                <p
                  style={{
                    margin: "var(--s-2) 0 0",
                    fontSize: 12.5,
                    color: "var(--ink-3)",
                    lineHeight: 1.45,
                  }}
                >
                  The cover image stays hosted on BlogSeeder and loads from here.
                  To fully self-host it, download the image and re-upload it on
                  your site.
                </p>
              )}

              {error && (
                <p className="form-error" style={{ margin: "var(--s-2) 0 0" }}>
                  {error}
                </p>
              )}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              marginTop: "var(--s-5)",
            }}
          >
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="btn --ghost --sm"
            >
              Close
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}

function CopyOption({
  title,
  desc,
  recommended,
  copied,
  onClick,
}: {
  title: string;
  desc: string;
  recommended?: boolean;
  copied: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--s-3)",
        textAlign: "left",
        padding: "12px 14px",
        borderRadius: 10,
        border: "1px solid var(--hairline-strong)",
        background: "var(--surface-sunken)",
        cursor: "pointer",
        width: "100%",
      }}
    >
      <span style={{ minWidth: 0 }}>
        <span
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontWeight: 700,
            color: "var(--ink-1)",
          }}
        >
          {title}
          {recommended && (
            <span
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 10,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--volt-700)",
                border: "1px solid var(--volt-300)",
                borderRadius: 999,
                padding: "1px 7px",
              }}
            >
              Recommended
            </span>
          )}
        </span>
        <span
          style={{
            display: "block",
            marginTop: 2,
            fontSize: 12.5,
            color: "var(--ink-3)",
            lineHeight: 1.4,
          }}
        >
          {desc}
        </span>
      </span>
      <span
        style={{
          flexShrink: 0,
          fontWeight: 600,
          fontSize: 13,
          color: copied ? "var(--ok-700)" : "var(--ink-1)",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied ✓" : "Copy"}
      </span>
    </button>
  );
}
