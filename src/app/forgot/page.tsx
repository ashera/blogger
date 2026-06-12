import Link from "next/link";
import { requestPasswordReset } from "@/lib/actions/password-reset";
import { Button, Field, Input } from "../_components/ui";

export const dynamic = "force-dynamic";

export default async function ForgotPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string }>;
}) {
  const { sent } = await searchParams;

  return (
    <div className="page auth-page">
      <main style={{ width: "100%", maxWidth: 400 }}>
        <div className="form-card">
          <div>
            <p className="eyebrow">Account recovery</p>
            <h1>Forgot your password?</h1>
            <p className="sub" style={{ marginTop: 8 }}>
              Enter your email and we&rsquo;ll send a reset link.{" "}
              <Link href="/login">Back to log in</Link>.
            </p>
          </div>

          {sent ? (
            <p className="form-success">
              If an account exists for that email, we&rsquo;ve sent a reset
              link. The link expires in 1 hour. Check your inbox (and spam
              folder).
            </p>
          ) : (
            <form
              action={requestPasswordReset}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--s-4)",
              }}
            >
              <Field label="Email" htmlFor="email">
                <Input
                  id="email"
                  type="email"
                  name="email"
                  required
                  autoComplete="email"
                />
              </Field>
              <Button
                type="submit"
                variant="primary"
                size="lg"
                block
                iconRight="arrow"
              >
                Send reset link
              </Button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
