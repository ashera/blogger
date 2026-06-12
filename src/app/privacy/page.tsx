import type { Metadata } from "next";
import Link from "next/link";
import { getBaseUrl } from "@/lib/email";

export const revalidate = 86400;

// Keep the source of truth in one place so the metadata + the
// visible page heading agree.
const LAST_UPDATED = "13 June 2026";

export async function generateMetadata(): Promise<Metadata> {
  const baseUrl = await getBaseUrl();
  const title = "Privacy policy — BlogSeeder";
  const description =
    "How BlogSeeder collects, uses, stores, and shares your information — including the content you send to our AI and web-research providers. Australian Privacy Principles (APP) compliant.";
  return {
    title,
    description,
    alternates: { canonical: `${baseUrl}/privacy` },
    openGraph: {
      type: "website",
      url: `${baseUrl}/privacy`,
      title,
      description,
      siteName: "BlogSeeder",
    },
    twitter: { card: "summary", title, description },
  };
}

const SECTIONS: Array<{ id: string; label: string }> = [
  { id: "who-we-are", label: "Who we are" },
  { id: "information-we-collect", label: "Information we collect" },
  { id: "how-we-use-it", label: "How we use your information" },
  { id: "ai-and-web", label: "AI generation & web research" },
  { id: "sharing", label: "Sharing & third parties" },
  { id: "cookies", label: "Cookies & local storage" },
  { id: "retention", label: "How long we keep your data" },
  { id: "your-rights", label: "Your rights" },
  { id: "security", label: "Security" },
  { id: "children", label: "Children's privacy" },
  { id: "changes", label: "Changes to this policy" },
  { id: "contact", label: "Contact us" },
];

export default function PrivacyPolicyPage() {
  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 760, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--s-7)" }}>
          <p className="eyebrow" style={{ margin: 0, color: "var(--ink-3)" }}>
            Legal
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
            Privacy policy
          </h1>
          <p
            style={{
              color: "var(--ink-2)",
              fontSize: "var(--t-body-l)",
              margin: 0,
              lineHeight: 1.55,
            }}
          >
            How BlogSeeder collects, uses, stores, and shares the information you
            give us — including what we send to the AI and web-research services
            that power the product — and the rights you have over it.
          </p>
          <p
            style={{
              marginTop: "var(--s-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 12,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            Last updated · {LAST_UPDATED}
          </p>
        </header>

        <nav
          aria-label="On this page"
          style={{
            padding: "var(--s-4) var(--s-5)",
            background: "var(--surface-sunken)",
            border: "1px solid var(--hairline)",
            borderRadius: 12,
            marginBottom: "var(--s-6)",
          }}
        >
          <p
            style={{
              margin: "0 0 var(--s-3)",
              fontFamily: "var(--font-mono)",
              fontSize: 11,
              letterSpacing: "0.12em",
              textTransform: "uppercase",
              color: "var(--ink-3)",
            }}
          >
            On this page
          </p>
          <ol
            style={{
              listStyle: "decimal inside",
              padding: 0,
              margin: 0,
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--ink-2)",
            }}
          >
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  style={{ color: "var(--ink-2)", textDecoration: "underline" }}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <article className="prose">
          <section id="who-we-are">
            <h2>1. Who we are</h2>
            <p>
              BlogSeeder is an AI tool for researching and generating
              SEO-focused blog posts, operated from Australia. When we say
              &ldquo;we,&rdquo; &ldquo;us,&rdquo; or &ldquo;BlogSeeder,&rdquo; we
              mean the operator of this service.
            </p>
            <p>
              This policy is written to align with the Australian Privacy
              Principles (APP) under the <em>Privacy Act 1988 (Cth)</em>. It
              applies to every visitor and registered user, anywhere in the
              world.
            </p>
          </section>

          <section id="information-we-collect">
            <h2>2. Information we collect</h2>

            <h3>2.1 Information you give us</h3>
            <ul>
              <li>
                <strong>Account details</strong> — your email address (used as
                your username), password (stored only as a salted bcrypt hash,
                never in plain text), and optional first name, surname, and
                title.
              </li>
              <li>
                <strong>Brand profile</strong> — the optional details you add to
                shape how the AI writes for you: brand/blog name, website URL,
                audience, voice &amp; tone, humour, point of view, key facts
                &amp; stats, stories, and things to avoid. These are tied to your
                account and used to steer generation.
              </li>
              <li>
                <strong>Blog seeds &amp; research</strong> — the subjects and
                starter keywords you enter, plus the keyword clusters, SERP /
                web-research notes, and image selections produced as you work
                through the seed wizard.
              </li>
              <li>
                <strong>Generated content</strong> — the posts you create or
                generate: titles, excerpts, Markdown body, tags, and any hero
                image you upload (stored with the post).
              </li>
            </ul>

            <h3>2.2 Information collected automatically</h3>
            <ul>
              <li>
                <strong>Post views</strong> — when a published post is opened we
                record the post and, if the reader is signed in, their account
                id (admin views are skipped; anonymous views are counted without
                identifying the reader). We do <em>not</em> store readers&rsquo;
                IP addresses for this. It drives the view counts on your
                dashboard.
              </li>
              <li>
                <strong>Standard request logs</strong> — our hosting provider
                records HTTP requests (URL, status code, timestamp, IP address)
                for security and debugging.
              </li>
              <li>
                <strong>Cookies</strong> — see section 6.
              </li>
            </ul>
            <p>
              We don&rsquo;t buy personal information about you from third
              parties or data brokers.
            </p>
          </section>

          <section id="how-we-use-it">
            <h2>3. How we use your information</h2>
            <ul>
              <li>
                To run the product — let you create seeds, research keywords and
                search results, generate and edit drafts, and manage and publish
                your blog.
              </li>
              <li>
                To authenticate you when you sign in and keep your session
                active.
              </li>
              <li>
                To send transactional emails — email verification, password
                reset, and email-change confirmation. We never send marketing
                emails without your explicit consent.
              </li>
              <li>To power the AI and research features — see section 4.</li>
              <li>
                To operate and secure the service, investigate misuse, and
                comply with our legal obligations.
              </li>
              <li>
                To improve BlogSeeder using aggregate, de-identified usage
                analytics.
              </li>
            </ul>
            <p>
              We do not sell your personal information, and we do not run
              third-party advertising networks on the site.
            </p>
          </section>

          <section id="ai-and-web">
            <h2>4. AI generation &amp; web research</h2>
            <p>
              Generating content is the core of BlogSeeder, and it necessarily
              sends some of your content to external services:
            </p>
            <ul>
              <li>
                <strong>AI generation</strong> — when you expand keywords, run
                research, or generate a post, we send the relevant inputs (your
                topic and keywords, the seed&rsquo;s research, and your brand
                profile) to our AI provider, <strong>Anthropic</strong>, to
                produce the result. Under Anthropic&rsquo;s commercial API
                terms, this content is processed to return your output and is
                not used to train their models.
              </li>
              <li>
                <strong>Web research</strong> — the research steps use the AI
                provider&rsquo;s web-search and page-fetch tools to look up
                publicly available pages based on your keywords and summarise
                what currently ranks. The searches reflect the keywords you
                provide.
              </li>
              <li>
                <strong>Images</strong> — when you add imagery we send your
                search phrases to our image provider, <strong>Pexels</strong>,
                to return stock photos. Body images are linked from Pexels; a
                hero image you choose is stored with your post.
              </li>
            </ul>
            <p>
              AI output can be inaccurate or generic — you are responsible for
              reviewing and editing every draft before you publish it. Please
              don&rsquo;t put personal, sensitive, or confidential information
              you wouldn&rsquo;t want processed by these providers into seeds,
              prompts, or brand-profile fields.
            </p>
          </section>

          <section id="sharing">
            <h2>5. Sharing &amp; third parties</h2>
            <p>
              Some of your information is necessarily handled by the service
              providers we use to run BlogSeeder. We pick providers with strong
              privacy commitments and share only what each one needs:
            </p>
            <ul>
              <li>
                <strong>Railway</strong> — our hosting and database provider.
                Your data is stored on their managed PostgreSQL service.
              </li>
              <li>
                <strong>Resend</strong> — sends our transactional emails. They
                receive the recipient address and the email body for each
                message.
              </li>
              <li>
                <strong>Anthropic</strong> — powers keyword clustering, web
                research, and post generation (see section 4). Receives the
                content you run through those tools, not your password or login
                details.
              </li>
              <li>
                <strong>Pexels</strong> — image search. Receives the search
                phrases you use to find photos; no account information is sent.
              </li>
            </ul>
            <p>
              <strong>Published posts are public.</strong> Anything you publish
              to your blog is visible to anyone on the web and may be indexed by
              search engines when indexing is enabled. A post you
              &ldquo;copy to your own website&rdquo; then lives on your site,
              under your control and policies, not ours.
            </p>
            <p>
              We do not transfer personal data overseas for marketing. Some of
              the providers above process data in jurisdictions other than
              Australia; we choose providers that offer comparable privacy
              protection.
            </p>
          </section>

          <section id="cookies">
            <h2>6. Cookies &amp; local storage</h2>
            <p>
              We use only a small number of first-party cookies. We do not use
              third-party advertising cookies or trackers.
            </p>
            <ul>
              <li>
                <strong>session</strong> — keeps you signed in. Marked HttpOnly
                and Secure. Expires 30 days after your last activity, or when you
                log out.
              </li>
              <li>
                <strong>status cookies</strong> — short-lived cookies set during
                email verification and email-change so we can show a one-time
                confirmation message, then discarded.
              </li>
              <li>
                <strong>theme</strong> — your light/dark preference, stored in
                your browser&rsquo;s local storage (not a cookie). It stays in
                your browser and is never sent to us.
              </li>
            </ul>
            <p>
              You can clear these from your browser at any time; you&rsquo;ll be
              logged out, but the rest of the site still works.
            </p>
          </section>

          <section id="retention">
            <h2>7. How long we keep your data</h2>
            <ul>
              <li>
                <strong>Account data</strong> — kept while your account is
                active. You can delete your account from your profile at any
                time; we remove your personal information within 30 days, minus
                anything we&rsquo;re legally required to retain.
              </li>
              <li>
                <strong>Brand profile, seeds, research &amp; drafts</strong> —
                kept while your account is active, and deleted or de-identified
                when you delete your account.
              </li>
              <li>
                <strong>Published posts</strong> — kept while they&rsquo;re live.
                Note that once a post is public, search engines and others may
                hold cached copies we can&rsquo;t remove, and any post you copied
                to your own website is controlled by you there.
              </li>
              <li>
                <strong>Verification &amp; reset tokens</strong> — deleted
                automatically when they expire (typically within hours of being
                sent).
              </li>
              <li>
                <strong>Request logs</strong> — retained by our hosting provider
                for the period needed for security, then deleted.
              </li>
            </ul>
          </section>

          <section id="your-rights">
            <h2>8. Your rights</h2>
            <p>Under Australian privacy law, you have the right to:</p>
            <ul>
              <li>
                Access the personal information we hold about you. Most of it is
                visible in your <Link href="/profile">profile</Link> and your
                posts; for anything else, contact us (see section 12).
              </li>
              <li>
                Correct anything inaccurate. You can edit your profile, brand
                profile, and posts yourself; for anything else, contact us.
              </li>
              <li>
                Delete your account from your{" "}
                <Link href="/profile">profile</Link>. We remove your personal
                information within 30 days, subject to any data we&rsquo;re
                legally required to keep.
              </li>
              <li>
                Make a privacy complaint. We&rsquo;ll respond within 30 days. If
                you&rsquo;re not satisfied, you can escalate to the Office of the
                Australian Information Commissioner (OAIC) at{" "}
                <a
                  href="https://www.oaic.gov.au"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  oaic.gov.au
                </a>
                .
              </li>
            </ul>
          </section>

          <section id="security">
            <h2>9. Security</h2>
            <p>
              We protect your information with industry-standard practices: HTTPS
              for every page, bcrypt hashing for passwords (never stored in plain
              text), session cookies marked HttpOnly and Secure, and an admin
              layer for operating the service. Our hosting provider applies
              further protections at the infrastructure layer.
            </p>
            <p>
              No system is perfectly secure. If we ever detect a data breach that
              meets the threshold under Australia&rsquo;s Notifiable Data
              Breaches scheme, we&rsquo;ll notify affected users and the OAIC as
              required by law.
            </p>
          </section>

          <section id="children">
            <h2>10. Children&rsquo;s privacy</h2>
            <p>
              BlogSeeder is intended for users aged 18 and over. We don&rsquo;t
              knowingly collect information from children under 18. If you become
              aware that a minor has created an account, contact us and
              we&rsquo;ll remove it.
            </p>
          </section>

          <section id="changes">
            <h2>11. Changes to this policy</h2>
            <p>
              We may update this policy from time to time — to reflect new
              features, new service providers, or changes in Australian privacy
              law. The &ldquo;last updated&rdquo; date at the top tells you when
              it last changed. Material changes will also be flagged on the site
              or notified by email.
            </p>
          </section>

          <section id="contact">
            <h2>12. Contact us</h2>
            <p>
              You can exercise most of your rights yourself from your{" "}
              <Link href="/profile">profile</Link> — edit your details or delete
              your account. For other privacy questions, access or correction
              requests, and complaints, contact the site operator; we respond
              within 30 days for privacy matters and faster where we can.
            </p>
          </section>
        </article>
      </main>
    </div>
  );
}
