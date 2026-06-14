import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { getBaseUrl } from "@/lib/email";

export const revalidate = 3600;

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const title = "FAQ — BlogSeeder";
  const description =
    "How to use BlogSeeder — training your blogging agent, seeds, keyword clusters, SERP research, generating posts, and publishing.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/faq` },
    openGraph: { type: "website", url: `${baseUrl}/faq`, title, description, siteName: "BlogSeeder" },
    twitter: { card: "summary", title, description },
  };
}

type QA = { q: string; a: ReactNode };
type Group = { title: string; items: QA[] };

const GROUPS: Group[] = [
  {
    title: "Getting started",
    items: [
      {
        q: "What is BlogSeeder?",
        a: (
          <>
            BlogSeeder researches and writes SEO-focused blog posts on any
            subject, in your brand&rsquo;s voice. You train a blogging{" "}
            <strong>agent</strong>, create topic <strong>seeds</strong>, and the
            AI generates complete, image-rich drafts you can edit and publish.
          </>
        ),
      },
      {
        q: "What's the quickest path to my first post?",
        a: (
          <>
            <ol style={{ margin: "4px 0 0", paddingLeft: 18, lineHeight: 1.6 }}>
              <li>
                Train your agent on the{" "}
                <Link href="/app/brand">brand profile</Link> page.
              </li>
              <li>
                Create a <Link href="/app/seeds">seed</Link> — the subject you
                want to write about.
              </li>
              <li>
                Work through the seed steps: keywords → cluster → SERP research →
                images → generate.
              </li>
              <li>Edit the draft, then publish or copy it to your own site.</li>
            </ol>
          </>
        ),
      },
      {
        q: "Do I have to set anything up before generating?",
        a: (
          <>
            You can generate straight away, but posts read generic until you
            train your agent. Spend a few minutes on your{" "}
            <Link href="/app/brand">brand profile</Link> first — it&rsquo;s the
            single biggest driver of how your blog sounds.
          </>
        ),
      },
    ],
  },
  {
    title: "Your blogging agent",
    items: [
      {
        q: "What is the “blogging agent”?",
        a: (
          <>
            It&rsquo;s the persona that writes your posts. Training it means
            filling in your brand profile — voice &amp; tone, humour, point of
            view, key facts, stories, and guardrails. Give the agent a name and
            it writes consistently in that voice.
          </>
        ),
      },
      {
        q: "How do I train my agent?",
        a: (
          <>
            On the <Link href="/app/brand">brand profile</Link>, enter your brand
            name, website, and audience, then let the AI draft every section for
            you. Edit each one to make it yours — the more specific you are, the
            better the writing.
          </>
        ),
      },
      {
        q: "What does “Trained 100%” mean?",
        a: (
          <>
            It&rsquo;s a measure of how complete your high-impact sections are
            (voice, audience, humour, point of view, guardrails, brand name).
            Higher training = posts that sound more like you and less like
            generic AI.
          </>
        ),
      },
      {
        q: "Can I change my agent's name or picture?",
        a: (
          <>
            Rename your agent anytime in the brand profile. The avatar is
            assigned automatically.
          </>
        ),
      },
    ],
  },
  {
    title: "Seeds, keywords & research",
    items: [
      {
        q: "What is a “seed”?",
        a: (
          <>
            A seed is a subject you build content around. Each one holds its own
            keywords, SERP research, image pool, and the posts generated from it.
          </>
        ),
      },
      {
        q: "What does “expand into a cluster” do?",
        a: (
          <>
            It turns your starter keywords into a tight set of related search
            queries to target together in one post, so it ranks for more than a
            single phrase.
          </>
        ),
      },
      {
        q: "What is SERP analysis?",
        a: (
          <>
            BlogSeeder reads the current top-ranking pages for your primary
            keyword and summarises their format, length, and topics. Your draft
            then covers what already wins — and adds the gaps they miss.
          </>
        ),
      },
      {
        q: "Where do the images come from?",
        a: (
          <>
            From Pexels stock photography, matched to your keywords. You choose a
            hero image and any in-body images on the seed&rsquo;s Images step.
          </>
        ),
      },
    ],
  },
  {
    title: "Generating & editing",
    items: [
      {
        q: "How do I generate a post?",
        a: (
          <>
            On a seed&rsquo;s Generate step, preview the prompt, confirm, and the
            AI writes a full draft. It usually takes 30–60 seconds.
          </>
        ),
      },
      {
        q: "Why does generation take a minute or two?",
        a: (
          <>
            It&rsquo;s doing real work — researching live search results, reading
            pages, and writing a complete article in your voice. A status dialog
            keeps you posted while it runs.
          </>
        ),
      },
      {
        q: "The draft isn't quite right — what now?",
        a: (
          <>
            Every draft is a starting point. Open the post and edit it freely —
            title, body, images, and tags — before you publish.
          </>
        ),
      },
    ],
  },
  {
    title: "Publishing & sharing",
    items: [
      {
        q: "How do I publish a post?",
        a: (
          <>
            Open the post and hit Publish, or schedule a future date. Published
            posts appear on your <Link href="/blog">blog</Link>.
          </>
        ),
      },
      {
        q: "How do I get a post onto my own website?",
        a: (
          <>
            Use <strong>Copy to your website</strong> (on the post&rsquo;s edit
            page or the posts list). Copy it as rich text, HTML, or Markdown and
            paste it into your own CMS.
          </>
        ),
      },
    ],
  },
  {
    title: "Account & data",
    items: [
      {
        q: "Is my data private?",
        a: (
          <>
            Your brand profile, seeds, and drafts are yours. To produce results,
            the content you run through the tools is sent to our AI and image
            providers. Full detail is in the{" "}
            <Link href="/privacy">privacy policy</Link>.
          </>
        ),
      },
      {
        q: "How do I delete my account?",
        a: (
          <>
            From your <Link href="/profile">profile</Link>. We remove your
            personal information within 30 days.
          </>
        ),
      },
    ],
  },
];

export default function FaqPage() {
  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--s-6)" }}>
          <p className="eyebrow" style={{ margin: 0, color: "var(--ink-3)" }}>
            Help
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--t-h1)",
              color: "var(--ink-1)",
              margin: "var(--s-2) 0 var(--s-3)",
              letterSpacing: "-0.02em",
              lineHeight: 1.05,
            }}
          >
            Frequently asked questions
          </h1>
          <p style={{ color: "var(--ink-2)", fontSize: "var(--t-body-l)", margin: 0, lineHeight: 1.55 }}>
            How BlogSeeder works — from training your agent to publishing your
            posts.
          </p>
        </header>

        {GROUPS.map((group) => (
          <section key={group.title} style={{ marginBottom: "var(--s-6)" }}>
            <h2
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 12,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: "var(--ink-3)",
                margin: "0 0 var(--s-3)",
              }}
            >
              {group.title}
            </h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {group.items.map((item, i) => (
                <details
                  key={i}
                  style={{
                    background: "var(--surface)",
                    border: "1px solid var(--hairline)",
                    borderRadius: 12,
                    padding: "var(--s-3) var(--s-4)",
                  }}
                >
                  <summary
                    style={{
                      cursor: "pointer",
                      fontWeight: 600,
                      color: "var(--ink-1)",
                      fontSize: "var(--t-body)",
                      listStyle: "none",
                    }}
                  >
                    {item.q}
                  </summary>
                  <div
                    style={{
                      marginTop: "var(--s-3)",
                      color: "var(--ink-2)",
                      fontSize: "var(--t-body)",
                      lineHeight: 1.6,
                    }}
                  >
                    {item.a}
                  </div>
                </details>
              ))}
            </div>
          </section>
        ))}

        <p style={{ color: "var(--ink-3)", fontSize: "var(--t-body-s)", marginTop: "var(--s-7)" }}>
          Still stuck? Most things are explained right where you work — the seed
          steps and the brand profile each have inline tips.
        </p>
      </main>
    </div>
  );
}
