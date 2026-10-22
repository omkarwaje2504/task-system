import { NextResponse } from "next/server";
import { bad, requireUser } from "@/lib/auth";
import { getUploadUrl, r2Configured, R2_PUBLIC_URL } from "@/lib/r2";

const MAX_BYTES = 500 * 1024 * 1024;

/** Returns a short-lived URL the browser PUTs the file to directly (browser → R2). */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  if (!r2Configured()) return bad("File uploads are not set up (R2 env vars missing).", 503);
  const { filename, contentType, size, folder } = await req.json().catch(() => ({}));
  if (!filename) return bad("filename is required.");
  if (size && Number(size) > MAX_BYTES) return bad("File is too big (max 500 MB).");
  const safeName = String(filename).replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
  const safeFolder = String(folder || "misc").replace(/[^a-z0-9-]/gi, "").slice(0, 40) || "misc";
  const key = `new-system/${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${safeName}`;
  const uploadUrl = await getUploadUrl(key, contentType);
  return NextResponse.json({ uploadUrl, key, url: `${R2_PUBLIC_URL()}/${key}` });
}
