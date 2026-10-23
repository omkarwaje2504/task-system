"use client";

import { useRef, useState } from "react";
import { FileVideoCamera, ImagePlus, LoaderCircle, RefreshCw, X } from "lucide-react";
import { uploadFile } from "@/lib/client";
import { toastError } from "@/lib/toast";
import type { AssetFile } from "@/lib/types";

/** One labelled drop box (e.g. "Cover") — uploads straight to R2 and shows a preview. */
export default function SlotUploader({ slot, file, onChange, folder }: { slot: string; file?: AssetFile; onChange: (f: AssetFile | null) => void; folder: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [drag, setDrag] = useState(false);

  async function handle(f?: File) {
    if (!f) return;
    if (!/^(image|video)\//.test(f.type)) return toastError(new Error("Please choose an image or a video."));
    setProgress(0);
    try {
      const url = await uploadFile(f, folder, setProgress);
      onChange({ slot, url, name: f.name, kind: f.type.startsWith("video/") ? "video" : "image" });
    } catch (e) {
      toastError(e);
    } finally {
      setProgress(null);
    }
  }

  return (
    <div>
      <p className="mb-1 text-xs font-semibold">{slot}</p>
      <div
        onClick={() => progress === null && input.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files[0]); }}
        className={`group relative flex aspect-[3/4] cursor-pointer items-center justify-center overflow-hidden rounded-lg border-2 border-dashed transition-colors ${
          drag ? "border-accent bg-accent-soft" : file ? "border-transparent" : "border-line hover:border-accent hover:bg-accent-soft/40"
        }`}>
        {file ? (
          <>
            {file.kind === "video"
              ? <video src={file.url} className="h-full w-full object-cover" muted playsInline />
              // eslint-disable-next-line @next/next/no-img-element -- user uploads on an arbitrary R2 domain
              : <img src={file.url} alt={slot} className="h-full w-full object-cover" />}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
              <span className="btn-ghost btn-sm"><RefreshCw className="h-3 w-3" />Replace</span>
            </div>
            <button type="button" aria-label={`Remove ${slot}`} onClick={(e) => { e.stopPropagation(); onChange(null); }}
              className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-danger">
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : progress !== null ? (
          <div className="flex flex-col items-center gap-1.5 text-xs font-semibold text-accent">
            <LoaderCircle className="h-6 w-6 animate-spin" />{progress}%
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 px-2 text-center text-muted">
            <ImagePlus className="h-5 w-5" />
            <span className="text-xs font-semibold">Tap or drop</span>
            <span className="flex items-center gap-1 text-[0.625rem]"><FileVideoCamera className="h-3 w-3" />image or video</span>
          </div>
        )}
        <input ref={input} type="file" accept="image/*,video/*" className="hidden" onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ""; }} />
      </div>
    </div>
  );
}
