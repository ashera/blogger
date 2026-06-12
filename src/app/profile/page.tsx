import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { updateProfile } from "@/lib/actions/auth";
import { requestEmailChange } from "@/lib/actions/email-change";
import { changePassword, deleteAccount } from "@/lib/actions/account";
import { Button, Field, Input } from "../_components/ui";
import { PasswordRules } from "../_components/password-rules";
import { PASSWORD_RULES_SUMMARY } from "@/lib/password-rules";

export const dynamic = "force-dynamic";

const TITLES = ["Mr", "Mrs", "Ms", "Mx", "Dr", "Prof"];

const EMAIL_ERRORS: Record<string, string> = {
  invalid: "That doesn't look like a valid email.",
  same: "That's already your current email.",
  password: "Password didn't match.",
  taken: "That email is already in use.",
  send: "We couldn't send the confirmation email. Try again in a moment.",
};

const DELETE_ERRORS: Record<string, string> = {
  password: "Password didn't match.",
  phrase: "Type DELETE exactly to confirm.",
};

const PASSWORD_ERRORS: Record<string, string> = {
  current: "Your current password didn't match.",
  weak: PASSWORD_RULES_SUMMARY,
  mismatch: "New password and confirmation don't match.",
  same: "New password is the same as your current one — pick a different one.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{
    saved?: string;
    email_sent?: string;
    email_error?: string;
    delete_error?: string;
    password_changed?: string;
    password_error?: string;
  }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const {
    saved,
    email_sent: emailSent,
    email_error: emailError,
    delete_error: deleteError,
    password_changed: passwordChanged,
    password_error: passwordError,
  } = await searchParams;
  const emailErrorMessage = emailError ? EMAIL_ERRORS[emailError] : null;
  const deleteErrorMessage = deleteError ? DELETE_ERRORS[deleteError] : null;
  const passwordErrorMessage = passwordError
    ? (PASSWORD_ERRORS[passwordError] ?? "Couldn't update your password.")
    : null;

  const displayName =
    [user.firstName, user.surname].filter(Boolean).join(" ").trim() ||
    user.email.split("@")[0] ||
    "Your profile";

  return (
    <div className="page page--pad">
      <main style={{ maxWidth: 880, margin: "0 auto" }}>
        <header style={{ marginBottom: "var(--s-6)" }}>
          <p className="eyebrow">Your profile</p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "var(--t-h1)",
              color: "var(--ink-1)",
              margin: "var(--s-2) 0 4px",
              letterSpacing: "-0.02em",
            }}
          >
            {displayName}
          </h1>
          <p style={{ color: "var(--ink-3)", margin: 0 }}>
            {user.email}
            {user.emailVerified ? " · verified" : " · not verified"}
          </p>
        </header>

        {saved && (
          <p className="form-success" style={{ marginBottom: "var(--s-5)" }}>
            Saved.
          </p>
        )}

        <section className="form-card">
          <h2 className="card-heading">Personal info</h2>
          <p className="card-sub">Optional. Used as your author byline.</p>

          <form
            action={updateProfile}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
          >
            <div className="grid-2">
              <Field label="Title" htmlFor="title">
                <select
                  id="title"
                  name="title"
                  className="input"
                  defaultValue={user.title ?? ""}
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
                  autoComplete="given-name"
                  defaultValue={user.firstName ?? ""}
                />
              </Field>
              <Field label="Surname" htmlFor="surname">
                <Input
                  id="surname"
                  name="surname"
                  type="text"
                  maxLength={64}
                  autoComplete="family-name"
                  defaultValue={user.surname ?? ""}
                />
              </Field>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary" iconRight="arrow">
                Save personal info
              </Button>
            </div>
          </form>
        </section>

        <section className="form-card" style={{ marginTop: "var(--s-5)" }}>
          <h2 className="card-heading">Change login email</h2>
          <p className="card-sub">
            Your email is also your username. Enter a new address and your
            current password — we&rsquo;ll send a confirmation link to the new
            address before switching.
          </p>

          {emailSent && !emailErrorMessage && (
            <p className="form-success" style={{ marginBottom: "var(--s-4)" }}>
              Confirmation sent. Click the link in the new inbox to finish the
              switch.
            </p>
          )}
          {emailErrorMessage && (
            <p className="form-error" style={{ marginBottom: "var(--s-4)" }}>
              {emailErrorMessage}
            </p>
          )}

          <form
            action={requestEmailChange}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
          >
            <Field label="New email" htmlFor="new_email">
              <Input
                id="new_email"
                name="new_email"
                type="email"
                autoComplete="email"
                required
                maxLength={254}
              />
            </Field>
            <Field label="Current password" htmlFor="email_change_password">
              <Input
                id="email_change_password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary" iconRight="arrow">
                Send confirmation
              </Button>
            </div>
          </form>
        </section>

        <section className="form-card" style={{ marginTop: "var(--s-5)" }}>
          <h2 className="card-heading">Change password</h2>
          <p className="card-sub">
            Enter your current password and a new one (8&ndash;72 characters).
            Other devices you&rsquo;re signed in on will be logged out; you&rsquo;ll
            stay signed in here.
          </p>

          {passwordChanged && !passwordErrorMessage && (
            <p className="form-success" style={{ marginBottom: "var(--s-4)" }}>
              Password updated. Other devices have been signed out.
            </p>
          )}
          {passwordErrorMessage && (
            <p className="form-error" style={{ marginBottom: "var(--s-4)" }}>
              {passwordErrorMessage}
            </p>
          )}

          <form
            action={changePassword}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
          >
            <Field label="Current password" htmlFor="current_password">
              <Input
                id="current_password"
                name="current_password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
              />
            </Field>
            <Field label="New password" htmlFor="new_password">
              <Input
                id="new_password"
                name="new_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </Field>
            <PasswordRules inputId="new_password" />
            <Field label="Confirm new password" htmlFor="confirm_password">
              <Input
                id="confirm_password"
                name="confirm_password"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="primary" iconRight="arrow">
                Update password
              </Button>
            </div>
          </form>
        </section>

        <section
          className="form-card"
          style={{
            marginTop: "var(--s-5)",
            borderColor: "var(--danger-500)",
          }}
        >
          <h2 className="card-heading">Delete account</h2>
          <p className="card-sub">
            Permanently removes your account and all your blog posts. This
            can&rsquo;t be undone.
          </p>

          {deleteErrorMessage && (
            <p className="form-error" style={{ marginBottom: "var(--s-4)" }}>
              {deleteErrorMessage}
            </p>
          )}

          <form
            action={deleteAccount}
            style={{ display: "flex", flexDirection: "column", gap: "var(--s-4)" }}
          >
            <Field label="Current password" htmlFor="delete_password">
              <Input
                id="delete_password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                maxLength={72}
              />
            </Field>
            <Field label="Type DELETE to confirm" htmlFor="delete_confirm">
              <Input
                id="delete_confirm"
                name="confirm"
                type="text"
                autoComplete="off"
                required
                maxLength={16}
                placeholder="DELETE"
              />
            </Field>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button type="submit" variant="dark">
                Delete my account
              </Button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
