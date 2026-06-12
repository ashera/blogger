import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";
import {
  updateUserAsAdmin,
  toggleAdminRole,
  toggleUserSuspended,
} from "@/lib/actions/users";
import { startImpersonation } from "@/lib/actions/impersonation";
import { Button, Field, Input } from "../../../_components/ui";

export const dynamic = "force-dynamic";

const TITLES = ["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof"];

type UserRow = {
  id: string;
  email: string;
  is_admin: boolean;
  email_verified_at: string | null;
  title: string | null;
  first_name: string | null;
  surname: string | null;
  created_at: string;
  suspended_at: string | null;
  post_count: string;
};

const ERRORS: Record<string, string> = {
  "self-demote": "You can't remove your own admin role.",
  "self-suspend": "You can't suspend yourself.",
};

async function fetchUser(id: string): Promise<UserRow | null> {
  try {
    const r = await query<UserRow>(
      `SELECT u.id::text,
              u.email,
              u.is_admin,
              u.email_verified_at::text,
              u.title,
              u.first_name,
              u.surname,
              u.created_at::text,
              u.suspended_at::text,
              (SELECT COUNT(*)::text FROM blog_posts WHERE author_id = u.id) AS post_count
         FROM users u
        WHERE u.id = $1::bigint
        LIMIT 1`,
      [id],
    );
    return r.rows[0] ?? null;
  } catch {
    return null;
  }
}

export default async function AdminUserDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const me = await requireAdmin();
  const { id } = await params;
  if (!/^\d+$/.test(id)) redirect("/admin/users");
  const { saved, error } = await searchParams;

  const u = await fetchUser(id);
  if (!u) notFound();

  const isSelf = u.id === me.id;
  const errorMessage = error ? ERRORS[error] : null;

  return (
    <div className="page admin-page" style={{ maxWidth: 760 }}>
      <Link href="/admin/users" className="back-link">
        ← All users
      </Link>

      <header className="admin-header">
        <p className="eyebrow">Admin · User</p>
        <h1>{u.email}</h1>
        <p className="sub">
          Joined {new Date(u.created_at).toLocaleDateString("en-US")} ·{" "}
          {u.post_count} posts ·{" "}
          {u.is_admin ? "Admin" : "Member"} ·{" "}
          {u.suspended_at ? "Suspended" : "Active"} ·{" "}
          {u.email_verified_at ? "Verified" : "Unverified"}
        </p>
      </header>

      {saved && (
        <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
          Saved.
        </p>
      )}
      {errorMessage && (
        <p className="form-error" style={{ marginBottom: "var(--s-5)" }}>
          {errorMessage}
        </p>
      )}

      <section className="form-card">
        <h2 className="card-heading">Profile</h2>
        <form
          action={updateUserAsAdmin}
          style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
        >
          <input type="hidden" name="userId" value={u.id} />
          <div className="grid-2">
            <Field label="Title" htmlFor="title">
              <select
                id="title"
                name="title"
                className="input"
                defaultValue={u.title ?? ""}
              >
                <option value="">—</option>
                {TITLES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </Field>
            <div />
          </div>
          <div className="grid-2">
            <Field label="First name" htmlFor="first_name">
              <Input
                id="first_name"
                name="first_name"
                type="text"
                maxLength={64}
                defaultValue={u.first_name ?? ""}
              />
            </Field>
            <Field label="Surname" htmlFor="surname">
              <Input
                id="surname"
                name="surname"
                type="text"
                maxLength={64}
                defaultValue={u.surname ?? ""}
              />
            </Field>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <Button type="submit" variant="primary" iconRight="arrow">
              Save
            </Button>
          </div>
        </form>
      </section>

      <section className="form-card" style={{ marginTop: "var(--s-5)" }}>
        <h2 className="card-heading">Actions</h2>
        <div style={{ display: "flex", gap: "var(--s-3)", flexWrap: "wrap" }}>
          <form action={toggleAdminRole}>
            <input type="hidden" name="userId" value={u.id} />
            <Button type="submit" variant="ghost" disabled={isSelf}>
              {u.is_admin ? "Remove admin" : "Make admin"}
            </Button>
          </form>
          <form action={toggleUserSuspended}>
            <input type="hidden" name="userId" value={u.id} />
            <Button type="submit" variant="ghost" disabled={isSelf}>
              {u.suspended_at ? "Unsuspend" : "Suspend"}
            </Button>
          </form>
          {!isSelf && (
            <form action={startImpersonation}>
              <input type="hidden" name="userId" value={u.id} />
              <Button type="submit" variant="dark">
                Log in as this user
              </Button>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}
