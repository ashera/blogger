import { redirect } from "next/navigation";

// The single "brand profile" is now one of several agents. Send any old
// links to the stable.
export default function BrandProfileRedirect() {
  redirect("/app/agents");
}
