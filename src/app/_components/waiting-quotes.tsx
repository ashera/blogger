"use client";

import { useEffect, useState } from "react";

/**
 * Light-hearted status lines shown, one at a time, while an AI call runs.
 * Generic enough for any "writing" wait (brand profile, blog post). Kept
 * deliberately long so repeats are rare within a single wait.
 */
export const WAITING_QUOTES = [
  "Reading your audience's mind…",
  "Finding your brand's voice (it was behind the couch)…",
  "Teaching the robot to sound like you, not a robot…",
  "Drafting opinions you didn't know you had…",
  "Workshopping jokes with the humour department…",
  "Quietly removing every instance of “game-changing”…",
  "Sprinkling in just enough personality…",
  "Negotiating with the rate limiter…",
  "Arguing about the Oxford comma…",
  "Polishing the finishing touches…",
  "Consulting the muses (they're on a tea break)…",
  "Untangling the metaphors…",
  "Deleting three exclamation marks…",
  "Making it sound effortless (it isn't)…",
  "Adding the bit that makes people actually read on…",
  "Resisting the urge to say “in today's fast-paced world”…",
  "Fact-checking, then fact-checking the fact-check…",
  "Trimming the waffle…",
  "Finding a better word than “utilise”…",
  "Putting a bow on it…",
];

/**
 * Spinner + a rotating quote, for the loading state inside a modal. Starts on
 * a random quote so different dialogs don't open on the same line.
 */
export function WaitingMessage({
  title,
  subtext,
  intervalMs = 3500,
}: {
  title?: string;
  subtext?: string;
  intervalMs?: number;
}) {
  const [i, setI] = useState(0);

  useEffect(() => {
    setI(Math.floor(Math.random() * WAITING_QUOTES.length));
    const id = setInterval(
      () => setI((x) => (x + 1) % WAITING_QUOTES.length),
      intervalMs,
    );
    return () => clearInterval(id);
  }, [intervalMs]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        textAlign: "center",
      }}
    >
      <div className="bs-spinner" aria-hidden style={{ marginBottom: "var(--s-4)" }} />
      {title && (
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 20,
            color: "var(--ink-1)",
            margin: "0 0 var(--s-2)",
          }}
        >
          {title}
        </h2>
      )}
      <p
        role="status"
        aria-live="polite"
        style={{
          color: "var(--ink-2)",
          fontSize: 15,
          minHeight: 44,
          margin: "0 0 var(--s-3)",
          lineHeight: 1.4,
          maxWidth: "40ch",
        }}
      >
        {WAITING_QUOTES[i]}
      </p>
      {subtext && (
        <p style={{ color: "var(--ink-4)", fontSize: 12, margin: 0 }}>{subtext}</p>
      )}
    </div>
  );
}
