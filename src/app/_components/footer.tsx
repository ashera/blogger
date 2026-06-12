import Link from "next/link";
import { buildInfo } from "@/lib/build-info";

/** Site-wide footer. */
export async function Footer() {
  return (
    <footer className="footer">
      <div className="row">
        <span>BlogSeeder · AI blog generation</span>
        <span className="meta">
          <Link href="/blog" style={{ color: "inherit" }}>
            Blog
          </Link>
          <span aria-hidden>·</span>
          <Link href="/privacy" style={{ color: "inherit" }}>
            Privacy
          </Link>
          <span aria-hidden>·</span>
          <span>v{buildInfo.version}</span>
          <span aria-hidden>·</span>
          <span title={buildInfo.commitFull}>{buildInfo.commit}</span>
        </span>
      </div>
    </footer>
  );
}
