// Project files (final artwork & anything else). Shared by the API and UI.

export type FileKind = "image" | "video" | "audio" | "pdf" | "text" | "office" | "design" | "archive" | "other";

export type ProjectFile = {
  _id: string;
  project: string;
  /** What the artwork is, e.g. "Final cover – Hindi". Empty = show the file name. */
  title?: string;
  /** The uploaded file's name. */
  name: string;
  url: string;
  mime: string;
  size: number;
  kind: FileKind;
  /** Small JPEG made in the browser at upload time (null when the type has none). */
  thumb: string | null;
  final: boolean;
  createdBy: string;
  createdByName: string;
  createdAt: string;
};

const EXT: Record<string, FileKind> = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image", avif: "image", svg: "image", bmp: "image", ico: "image",
  mp4: "video", mov: "video", webm: "video", m4v: "video", mkv: "video", avi: "video",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio", ogg: "audio", flac: "audio",
  pdf: "pdf",
  txt: "text", csv: "text", json: "text", md: "text", srt: "text", vtt: "text", xml: "text", log: "text",
  doc: "office", docx: "office", xls: "office", xlsx: "office", ppt: "office", pptx: "office",
  ai: "design", eps: "design", psd: "design", cdr: "design", indd: "design", fig: "design", sketch: "design", xd: "design",
  zip: "archive", rar: "archive", "7z": "archive", tar: "archive", gz: "archive",
};

export const extOf = (name: string) => (name.includes(".") ? name.split(".").pop()!.toLowerCase() : "");

export function fileKind(name: string, mime = ""): FileKind {
  const byExt = EXT[extOf(name)];
  if (byExt) return byExt;
  if (mime.startsWith("image/")) return "image";
  if (mime.startsWith("video/")) return "video";
  if (mime.startsWith("audio/")) return "audio";
  if (mime === "application/pdf") return "pdf";
  if (mime.startsWith("text/")) return "text";
  return "other";
}

/** Images the browser can't draw (HEIC, TIFF…) get an icon instead of a preview. */
export function browserCanShow(f: Pick<ProjectFile, "kind" | "name">) {
  if (f.kind !== "image") return true;
  return !["heic", "heif", "tif", "tiff"].includes(extOf(f.name));
}

/** Title if one was given, else the file name. */
export const fileLabel = (f: Pick<ProjectFile, "title" | "name">) => f.title?.trim() || f.name;

export function fmtSize(bytes: number) {
  if (!bytes) return "";
  const u = ["B", "KB", "MB", "GB"];
  const i = Math.min(u.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  return `${(bytes / 1024 ** i).toFixed(i ? 1 : 0)} ${u[i]}`;
}
