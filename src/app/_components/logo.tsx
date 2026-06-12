/* BlogSeeder logo — the "rich" sprout mark (soil mound, veined two-tone
   leaves) plus the wordmark. Pure markup, so it renders fine in server
   components like the topbar. Colours come from the theme tokens:
   stem/outline = --ink-1, foliage = --volt-600 — so it adapts to light/dark. */

export function BrandMark({
  size = 30,
  title = "BlogSeeder",
}: {
  size?: number;
  title?: string;
}) {
  const stem = "var(--ink-1)";
  const leaf = "var(--volt-600)";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      role="img"
      aria-label={title}
      style={{ display: "block", flex: "none" }}
    >
      {/* soil mound */}
      <path
        d="M4 27 Q6.5 23.4 10 24.8 Q13 26 16 24.2 Q19 26 22 24.8 Q25.5 23.4 28 27 Z"
        fill={stem}
      />
      {/* stem */}
      <path
        d="M16 25 C16.2 21 15.2 18 16 14.5"
        stroke={stem}
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* right leaf (higher) */}
      <path
        d="M16 16.5 C18 9.5 22.5 6.5 28 7.2 C28 13 23 17.2 16 16.5 Z"
        fill={leaf}
        stroke={stem}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path
        d="M17.2 15.4 L25.6 8.6"
        stroke={stem}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
      {/* left leaf (lower, deeper tone) */}
      <path
        d="M16 18.5 C14 12.5 9.8 10 4.6 11 C4.6 16.2 9.6 19.4 16 18.5 Z"
        fill={leaf}
        stroke={stem}
        strokeWidth="1.4"
        strokeLinejoin="round"
        opacity="0.85"
      />
      <path
        d="M14.8 17.4 L6.8 12.6"
        stroke={stem}
        strokeWidth="1.1"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Mark + wordmark, for the topbar. Inherits the `.brand` link styles. */
export function BrandLogo({ markSize = 30 }: { markSize?: number }) {
  return (
    <>
      <BrandMark size={markSize} />
      <span className="brand-wordmark">
        Blog<span style={{ color: "var(--volt-600)" }}>Seeder</span>
      </span>
    </>
  );
}
