import { NextResponse } from "next/server";
import { query } from "@/lib/db";

// Serves a self-hosted post image (bytes stored in blog_images) from our own
// origin, so in-body post images never hotlink images.pexels.com.

type ImageRow = {
  bytes: Buffer;
  mime_type: string;
  byte_size: number;
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await ctx.params;
  if (!/^\d+$/.test(id)) {
    return new NextResponse("Not found", { status: 404 });
  }

  let row: ImageRow | undefined;
  try {
    const r = await query<ImageRow>(
      `SELECT bytes, mime_type, byte_size FROM blog_images
        WHERE id = $1::bigint LIMIT 1`,
      [id],
    );
    row = r.rows[0];
  } catch {
    return new NextResponse("Server error", { status: 500 });
  }

  if (!row) return new NextResponse("Not found", { status: 404 });

  return new NextResponse(new Uint8Array(row.bytes), {
    status: 200,
    headers: {
      "Content-Type": row.mime_type,
      "Content-Length": String(row.byte_size),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
