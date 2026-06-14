import Link from "next/link";
import { logout } from "@/lib/actions/auth";
import { endImpersonation } from "@/lib/actions/impersonation";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { ButtonLink } from "./ui";
import { MobileMenu } from "./mobile-menu";
import { AvatarMenu } from "./avatar-menu";
import { ThemeToggle } from "./theme-toggle";
import { BrandLogo } from "./logo";

async function getDbOk(): Promise<boolean> {
  try {
    await query("SELECT 1");
    return true;
  } catch {
    return false;
  }
}

export async function AuthNav() {
  const [user, dbOk] = await Promise.all([getCurrentUser(), getDbOk()]);

  return (
    <>
      {user?.impersonatorId && user?.impersonatorEmail && (
        <div
          role="status"
          aria-live="polite"
          style={{
            width: "100%",
            background: "var(--warn-50)",
            borderBottom: "1px solid var(--warn-300)",
            color: "var(--warn-700)",
            padding: "8px 16px",
            boxSizing: "border-box",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            fontSize: 13,
          }}
        >
          <span>
            Acting as <strong>{user.email}</strong> — admin{" "}
            <strong>{user.impersonatorEmail}</strong>
          </span>
          <form action={endImpersonation}>
            <button
              type="submit"
              style={{
                padding: "4px 12px",
                borderRadius: 999,
                background: "var(--warn-700)",
                color: "var(--paper)",
                border: 0,
                fontWeight: 600,
                fontSize: 12,
                cursor: "pointer",
              }}
            >
              Switch back to admin →
            </button>
          </form>
        </div>
      )}
      <header className="topbar">
        <div className="brand-row">
          <Link href="/" className="brand" aria-label="BlogSeeder home">
            <BrandLogo />
          </Link>
          <div
            className={`topbar-stats ${dbOk ? "--ok" : "--err"}`}
            title={dbOk ? "Database connected" : "Database unreachable"}
          >
            <span className="dot" aria-hidden />
            <span>{dbOk ? "Live" : "Down"}</span>
          </div>
        </div>

        <MobileMenu>
          <div className="topbar-menu-panel">
            <nav>
              <Link href="/blog">My Blogs</Link>
              <Link href="/faq">FAQ</Link>
              {user && <Link href="/app">Dashboard</Link>}
              {user?.isAdmin && (
                <Link href="/admin" className="nav-admin">
                  Admin
                </Link>
              )}
            </nav>

            <div className="actions">
              <ThemeToggle />
              {user ? (
                <AvatarMenu
                  email={user.email}
                  name={
                    [user.firstName, user.surname].filter(Boolean).join(" ") ||
                    null
                  }
                >
                  <Link href="/app">Dashboard</Link>
                  <Link href="/profile">Profile</Link>
                  <form action={logout}>
                    <button type="submit">Log out</button>
                  </form>
                </AvatarMenu>
              ) : (
                <>
                  <ButtonLink href="/login" variant="ghost" size="sm">
                    Log in
                  </ButtonLink>
                  <ButtonLink
                    href="/register"
                    variant="dark"
                    size="sm"
                    icon="plus"
                  >
                    Register
                  </ButtonLink>
                </>
              )}
            </div>
          </div>
        </MobileMenu>
      </header>
    </>
  );
}
