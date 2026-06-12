"use client";

import { useState } from "react";

type Example = {
  brandName: string;
  siteUrl: string;
  audience: string;
  voice: string;
  humour: string;
  perspective: string;
  stats: string;
  stories: string;
  avoid: string;
};

// example key → form field id
const FIELD_MAP: Array<[keyof Example, string]> = [
  ["brandName", "brand_name"],
  ["siteUrl", "site_url"],
  ["audience", "audience"],
  ["voice", "voice"],
  ["humour", "humour"],
  ["perspective", "perspective"],
  ["stats", "stats"],
  ["stories", "stories"],
  ["avoid", "avoid"],
];

/**
 * Fills the brand-profile form's BLANK fields with example content (never
 * overwrites what the user has typed). The example is a demo brand, so the
 * warning makes clear it must be rewritten before it's used for real.
 */
export function BrandExampleLoader({ example }: { example: Example }) {
  const [loaded, setLoaded] = useState(false);

  function load() {
    for (const [key, id] of FIELD_MAP) {
      const el = document.getElementById(id) as
        | HTMLInputElement
        | HTMLTextAreaElement
        | null;
      if (!el) continue;
      const val = example[key];
      if (val && el.value.trim().length === 0) el.value = val;
    }
    setLoaded(true);
  }

  return (
    <section
      className="form-card"
      style={{
        marginBottom: "var(--s-5)",
        borderLeft: "3px solid var(--warn-300)",
        background: "var(--warn-50)",
      }}
    >
      <h2 className="card-heading" style={{ margin: 0 }}>
        New here? Load an example to see what good looks like
      </h2>
      <p className="card-sub" style={{ marginTop: 4 }}>
        These are sample values from a <strong>demo brand</strong> — a
        dress-resale shop called Frockd — to show the level of detail that
        produces strong, on-voice posts. They are <strong>not your brand</strong>
        . Load them into the empty fields as a scaffold, then rewrite every field
        in your own voice. If you generate with the example left as-is, your
        posts will sound like a different business.
      </p>
      <button type="button" onClick={load} className="btn --ghost --sm">
        Load example into blank fields
      </button>
      {loaded && (
        <p
          role="status"
          style={{
            marginTop: "var(--s-3)",
            marginBottom: 0,
            padding: "10px 12px",
            background: "var(--warn-100)",
            border: "1px solid var(--warn-300)",
            borderRadius: 8,
            color: "var(--warn-700)",
            fontSize: "var(--t-body-s)",
            fontWeight: 600,
          }}
        >
          Example content loaded into the blank fields. This is a{" "}
          <strong>demo brand&rsquo;s</strong> profile — rewrite each field in
          your own brand&rsquo;s voice and save before generating, or your posts
          will read like someone else&rsquo;s business.
        </p>
      )}
    </section>
  );
}
