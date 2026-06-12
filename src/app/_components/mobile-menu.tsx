"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

export function MobileMenu({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Element | null;
      if (!target) return;
      // Outside-click closes immediately. Inside clicks are handled in
      // the click handler below (which fires *after* the browser has a
      // chance to dispatch form submits and link navigation).
      if (!el.contains(target)) setOpen(false);
    }

    function onClick(e: MouseEvent) {
      const el = ref.current;
      if (!el) return;
      const target = e.target as Element | null;
      if (!target || !el.contains(target)) return;

      // Don't close on the hamburger toggle (let the button toggle naturally).
      if (target.closest(".topbar-toggle")) return;
      // Close on link/button taps inside the menu — but defer one tick so
      // the form action / link navigation has already fired before we
      // unmount the action's DOM.
      if (target.closest("a, button")) {
        setTimeout(() => setOpen(false), 0);
      }
    }

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("click", onClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("click", onClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={ref} className={`topbar-menu ${open ? "is-open" : ""}`}>
      <button
        type="button"
        className="topbar-toggle"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close menu" : "Open menu"}
        aria-expanded={open}
      >
        <span className="hamburger" aria-hidden>
          <span />
          <span />
          <span />
        </span>
      </button>
      {children}
    </div>
  );
}
