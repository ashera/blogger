// Pure (client + server safe). Routes external image URLs through our own
// same-origin /api/img proxy so the browser never requests images.pexels.com
// directly — corporate proxies frequently block that CDN. Only allowlisted
// hosts are proxied (no open proxy / SSRF); anything else is returned as-is.

/** Hosts the /api/img proxy is permitted to fetch from. */
export const PROXYABLE_IMAGE_HOSTS = new Set(["images.pexels.com"]);

export function isProxyableImageUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && PROXYABLE_IMAGE_HOSTS.has(u.hostname);
  } catch {
    return false;
  }
}

/**
 * Build a same-origin URL for an image. Local URLs (/api/…) pass through;
 * allowlisted external images are routed via the proxy; anything else is left
 * unchanged (e.g. a host we don't proxy).
 */
export function proxiedImage(url: string | null | undefined): string {
  if (!url) return "";
  if (url.startsWith("/")) return url;
  return isProxyableImageUrl(url) ? `/api/img?u=${encodeURIComponent(url)}` : url;
}

/**
 * Rewrite every <img src="…pexels…"> in a chunk of HTML to go through the
 * proxy. Used as a render-time safety net for posts whose body still embeds
 * absolute Pexels URLs (created before self-hosting).
 */
export function proxyImagesInHtml(html: string): string {
  return html.replace(
    /(<img\b[^>]*?\bsrc=")([^"]+)(")/gi,
    (_m, pre, src, post) => `${pre}${proxiedImage(src)}${post}`,
  );
}
