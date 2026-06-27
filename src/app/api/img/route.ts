import { NextResponse } from "next/server";
import { isProxyableImageUrl } from "@/lib/image-proxy";

// Streams an allowlisted external image through our own origin so the browser
// never has to reach images.pexels.com (often blocked by corporate proxies).
// Strictly host-allowlisted — not an open proxy.

export const dynamic = "force-dynamic";

const MAX_BYTES = 12 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 15_000;

export async function GET(req: Request): Promise<NextResponse> {
  const u = new URL(req.url).searchParams.get("u");
  if (!u || !isProxyableImageUrl(u)) {
    return new NextResponse("Bad request", { status: 400 });
  }

  try {
    const upstream = await fetch(u, {
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      // Don't forward cookies/credentials to the image host.
      headers: { Accept: "image/*" },
    });
    if (!upstream.ok) {
      return new NextResponse("Upstream error", { status: 502 });
    }
    const mime = upstream.headers.get("content-type") ?? "image/jpeg";
    if (!mime.startsWith("image/")) {
      return new NextResponse("Not an image", { status: 415 });
    }
    const ab = await upstream.arrayBuffer();
    if (ab.byteLength === 0 || ab.byteLength > MAX_BYTES) {
      return new NextResponse("Bad upstream size", { status: 502 });
    }
    return new NextResponse(new Uint8Array(ab), {
      status: 200,
      headers: {
        "Content-Type": mime,
        "Content-Length": String(ab.byteLength),
        // Cache hard at the browser + any CDN in front of us.
        "Cache-Control": "public, max-age=604800, s-maxage=2592000, immutable",
      },
    });
  } catch {
    return new NextResponse("Upstream error", { status: 502 });
  }
}
