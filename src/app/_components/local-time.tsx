"use client";

import { useEffect, useState } from "react";

/**
 * Renders a timestamp in the *viewer's* locale and timezone. Server components
 * can't know the browser locale, so we render a deterministic value first
 * (fixed en-GB / UTC, so SSR and first client render match) then swap to the
 * user's local format after mount.
 */
export function LocalTime({
  iso,
  dateOnly = false,
  options,
  empty = "—",
}: {
  iso: string | null | undefined;
  /** Show date only (no time). Ignored when `options` is provided. */
  dateOnly?: boolean;
  /** Explicit Intl options override. */
  options?: Intl.DateTimeFormatOptions;
  empty?: string;
}) {
  const opts: Intl.DateTimeFormatOptions =
    options ??
    (dateOnly
      ? { dateStyle: "medium" }
      : { dateStyle: "medium", timeStyle: "short" });

  const [text, setText] = useState<string>(() => {
    if (!iso) return empty;
    // Deterministic: fixed locale + UTC so server and first client render agree.
    return new Intl.DateTimeFormat("en-GB", { ...opts, timeZone: "UTC" }).format(
      new Date(iso),
    );
  });

  useEffect(() => {
    if (!iso) {
      setText(empty);
      return;
    }
    setText(new Intl.DateTimeFormat(undefined, opts).format(new Date(iso)));
    // opts is derived from props that rarely change; re-run on iso change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iso]);

  if (!iso) return <>{empty}</>;
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {text}
    </time>
  );
}
