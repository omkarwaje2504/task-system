import "server-only";
import { R2_PUBLIC_URL } from "./r2";
import { fileKind } from "./files";
import type { TaskFile } from "./generalTasks";

/** Only URLs from our own bucket (what /api/upload/presign hands out). */
const ours = (v: unknown) => typeof v === "string" && v.startsWith(`${R2_PUBLIC_URL()}/new-system/`) && v.length < 1000;

/** Attachments the browser already uploaded to R2. */
export function cleanTaskFiles(v: unknown): TaskFile[] {
  if (!Array.isArray(v)) return [];
  return v.filter((f) => f && ours(f.url)).slice(0, 20).map((f) => {
    const name = String(f.name || "file").trim().slice(0, 200);
    const mime = String(f.mime || "").slice(0, 120);
    return { name, url: f.url, mime, size: Math.max(0, Number(f.size) || 0), kind: fileKind(name, mime), thumb: ours(f.thumb) ? f.thumb : null };
  });
}
