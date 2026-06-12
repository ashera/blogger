import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { query } from "@/lib/db";

export const dynamic = "force-dynamic";
export const metadata = { title: "Users — Admin" };

type Row = {
  id: string;
  email: string;
  is_admin: boolean;
  email_verified_at: string | null;
  first_name: string | null;
  surname: string | null;
  created_at: string;
  suspended_at: string | null;
  post_count: string;
};

function fullName(r: Row): string {
  const parts = [r.first_name, r.surname].filter(Boolean) as string[];
  return parts.length > 0 ? parts.join(" ") : "—";
}

function formatDate(s: string): string {
  try {
    return new Date(s).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return s;
  }
}

async function fetchUsers(): Promise<Row[]> {
  try {
    const r = await query<Row>(
      `SELECT u.id::text,
              u.email,
              u.is_admin,
              u.email_verified_at::text,
              u.first_name,
              u.surname,
              u.created_at::text,
              u.suspended_at::text,
              (SELECT COUNT(*)::text FROM blog_posts WHERE author_id = u.id) AS post_count
         FROM users u
         ORDER BY u.created_at DESC`,
    );
    return r.rows;
  } catch {
    return [];
  }
}

export default async function AdminUsersPage() {
  await requireAdmin();
  const rows = await fetchUsers();

  return (
    <div className="page admin-page" style={{ maxWidth: 1100 }}>
      <Link href="/admin" className="back-link">
        ← Admin console
      </Link>

      <header className="admin-header">
        <p className="eyebrow">Admin · Users</p>
        <h1>Users</h1>
        <p className="sub">
          {rows.length} total · {rows.filter((r) => r.is_admin).length} admin ·{" "}
          {rows.filter((r) => r.suspended_at).length} suspended
        </p>
      </header>

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No users yet</h3>
        </div>
      ) : (
        <div className="users-table">
          <div className="users-row users-head">
            <div>Email</div>
            <div>Name</div>
            <div>Posts</div>
            <div>Joined</div>
            <div>Status</div>
          </div>
          {rows.map((u) => (
            <Link
              key={u.id}
              href={`/admin/users/${u.id}`}
              className={`users-row users-item ${u.suspended_at ? "is-suspended" : ""}`}
            >
              <div className="users-email">
                {u.email}
                {u.is_admin && <span className="users-tag --admin">Admin</span>}
                {!u.email_verified_at && (
                  <span className="users-tag --susp">Unverified</span>
                )}
              </div>
              <div>{fullName(u)}</div>
              <div>{u.post_count}</div>
              <div className="users-date">{formatDate(u.created_at)}</div>
              <div>
                {u.suspended_at ? (
                  <span className="users-tag --susp">Suspended</span>
                ) : (
                  <span className="users-tag --ok">Active</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
