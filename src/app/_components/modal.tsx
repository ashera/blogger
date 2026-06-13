"use client";

import { useEffect, type ReactNode } from "react";

/**
 * Centered modal overlay — the shared look for every dialog in the app:
 * a dark scrim, a rounded surface card, escape/backdrop to dismiss, and a
 * locked background scroll. Render it conditionally on `open`.
 */
export function Modal({
  open,
  onClose,
  children,
  maxWidth = 520,
  /** Set false to prevent backdrop / escape dismissal (e.g. while a blocking
   *  action runs). */
  dismissable = true,
  /** Card padding. Pass "0" when the content supplies its own header/footer
   *  padding. */
  padding = "var(--s-6) var(--s-7)",
  /** Higher than the sticky footers (z 5) and the warn dialog default. */
  zIndex = 60,
}: {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  maxWidth?: number;
  dismissable?: boolean;
  padding?: string;
  zIndex?: number;
}) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && dismissable) onClose();
    }
    document.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, dismissable, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex,
        background: "color-mix(in oklab, var(--ink-1) 55%, transparent)",
        display: "grid",
        placeItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          width: `min(${maxWidth}px, 100%)`,
          maxHeight: "calc(100vh - 32px)",
          overflow: "auto",
          background: "var(--surface)",
          color: "var(--ink-1)",
          borderRadius: 14,
          boxShadow: "var(--e-4)",
          padding,
        }}
      >
        {children}
      </div>
    </div>
  );
}
