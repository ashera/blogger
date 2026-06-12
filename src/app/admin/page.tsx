import Link from "next/link";
import { requireAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const ADMIN_LINKS: Array<{ href: string; title: string; desc: string }> = [
  {
    href: "/app/posts",
    title: "My Posts",
    desc: "Write, edit, publish, and unpublish your own blog posts.",
  },
  {
    href: "/app/seeds",
    title: "Blog seeds",
    desc: "Your blog seeds — keyword clusters, SERP analysis, images, and AI post generation.",
  },
  {
    href: "/admin/builder-settings",
    title: "Generation Limits",
    desc: "Max-token caps for the AI generation calls (post, SERP, cluster).",
  },
  {
    href: "/admin/users",
    title: "Manage Users",
    desc: "View accounts, edit profiles, suspend, and log in as a user.",
  },
  {
    href: "/admin/errors",
    title: "Error Log",
    desc: "External-service failures (AI writer, image search) for diagnosing user-reported issues.",
  },
  {
    href: "/admin/site-settings",
    title: "Site Settings",
    desc: "Block crawlers pre-launch and other site-wide switches.",
  },
  {
    href: "/admin/database",
    title: "Database Structure",
    desc: "Tables, descriptions, and current row counts.",
  },
  {
    href: "/admin/docs",
    title: "Project Documentation",
    desc: "Rendered view of README.md — stack, architecture, deploy notes.",
  },
  {
    href: "/admin/docs/flows",
    title: "Workflow Diagrams",
    desc: "Rendered Mermaid diagrams covering the major flows.",
  },
  {
    href: "/admin/emails",
    title: "Captured Emails",
    desc: "Local inbox of outbound email captured when running with EMAIL_CAPTURE=1.",
  },
];

export default async function AdminHomePage() {
  await requireAdmin();

  return (
    <div className="page admin-page">
      <header className="admin-header">
        <p className="eyebrow">Admin</p>
        <h1>Admin console</h1>
        <p className="sub">Tools for managing blogger.</p>
      </header>

      <ul className="admin-list">
        {ADMIN_LINKS.map((l) => (
          <li key={l.href}>
            <Link href={l.href} className="admin-tile">
              <div className="admin-tile-body">
                <div className="admin-tile-title">{l.title}</div>
                <div className="admin-tile-desc">{l.desc}</div>
              </div>
              <span className="admin-tile-arrow" aria-hidden>
                →
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
