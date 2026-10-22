export type AssetFile = { slot: string; url: string; name: string; kind: "image" | "video" | "file" };

export function cleanFiles(v: unknown): AssetFile[] {
  if (!Array.isArray(v)) return [];
  return v
    .filter((f) => f && typeof f.url === "string" && /^https?:\/\//.test(f.url))
    .map((f): AssetFile => ({
      slot: String(f.slot || "").trim(),
      url: f.url,
      name: String(f.name || "").slice(0, 200),
      kind: f.kind === "video" ? "video" : f.kind === "file" ? "file" : "image",
    }))
    .slice(0, 20);
}
