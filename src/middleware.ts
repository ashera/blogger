import { NextResponse, type NextRequest } from "next/server";

/**
 * Forwards the request pathname as an `x-pathname` header so server
 * components (e.g. the root layout's maintenance allowlist) can read the
 * current path during render.
 */
export function middleware(req: NextRequest) {
  const requestHeaders = new Headers(req.headers);
  requestHeaders.set("x-pathname", req.nextUrl.pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  // Skip Next internals, API routes, and any URL that looks like a static asset.
  matcher: ["/((?!api|_next|favicon|.*\\..*).*)"],
};
