"use client";

import { extOf, fileKind } from "./files";

// Thumbnails are made in the browser from the local file at upload time, so
// previews never depend on the bucket allowing cross-origin reads.

const MAX = 640;
const QUALITY = 0.82;

let pdfjsPromise: Promise<typeof import("pdfjs-dist")> | null = null;
function getPdfjs() {
  // Same loader as the media tools: the worker is bundled, not fetched from a CDN.
  pdfjsPromise ??= import("pdfjs-dist").then((lib) => {
    lib.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    return lib;
  });
  return pdfjsPromise;
}

function fit(w: number, h: number) {
  const k = Math.min(1, MAX / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * k)), h: Math.max(1, Math.round(h * k)) };
}

function toJpeg(draw: (ctx: CanvasRenderingContext2D) => void, w: number, h: number) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff"; // transparent PNGs / PDFs on white, like a page
  ctx.fillRect(0, 0, w, h);
  draw(ctx);
  return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
}

async function imageThumb(file: File) {
  const bmp = await createImageBitmap(file);
  const { w, h } = fit(bmp.width, bmp.height);
  const blob = await toJpeg((ctx) => ctx.drawImage(bmp, 0, 0, w, h), w, h);
  bmp.close();
  return blob;
}

function videoThumb(file: File) {
  return new Promise<Blob | null>((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    const done = (b: Blob | null) => {
      clearTimeout(timeout);
      URL.revokeObjectURL(url);
      resolve(b);
    };
    const timeout = setTimeout(() => done(null), 10000);
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.onloadedmetadata = () => { v.currentTime = Math.min(1, (v.duration || 0) / 3); };
    v.onseeked = async () => {
      const { w, h } = fit(v.videoWidth || 640, v.videoHeight || 360);
      done(await toJpeg((ctx) => ctx.drawImage(v, 0, 0, w, h), w, h));
    };
    v.onerror = () => done(null);
    v.src = url;
  });
}

async function pdfThumb(file: File) {
  const pdfjs = await getPdfjs();
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  const pdf = await task.promise;
  try {
    const page = await pdf.getPage(1);
    const base = page.getViewport({ scale: 1 });
    const { w, h } = fit(base.width, base.height);
    const viewport = page.getViewport({ scale: w / base.width });
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    return await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
  } finally {
    task.destroy();
  }
}

/**
 * A JPEG thumbnail for images, videos, PDFs and Illustrator files (most .ai
 * files are saved PDF-compatible). Null for anything else, or if it fails.
 */
export async function makeThumb(file: File): Promise<File | null> {
  const kind = fileKind(file.name, file.type);
  const ext = extOf(file.name);
  try {
    let blob: Blob | null = null;
    if (kind === "image" && !["heic", "heif", "tif", "tiff", "svg", "ico"].includes(ext) && file.size < 60 * 1024 * 1024) blob = await imageThumb(file);
    else if (kind === "video") blob = await videoThumb(file);
    else if ((kind === "pdf" || ext === "ai") && file.size < 200 * 1024 * 1024) blob = await pdfThumb(file);
    return blob ? new File([blob], `${file.name.replace(/\.[^.]+$/, "")}-thumb.jpg`, { type: "image/jpeg" }) : null;
  } catch {
    return null;
  }
}
