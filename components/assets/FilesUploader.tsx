"use client";

import { useRef, useState, type Dispatch, type SetStateAction } from "react";
import { FileVideoCamera, ImagePlus, LoaderCircle, X } from "lucide-react";
import { uploadFile } from "@/lib/client";
import { toastError } from "@/lib/toast";
import type { AssetFile } from "@/lib/types";

const MAX = 20;

/** Drop zone for any number of images/videos — uploads straight to R2; each file gets a preview and a title the user types. */
export default function FilesUploader({ files, onChange, folder }: { files: AssetFile[]; onChange: Dispatch<SetStateAction<AssetFile[]>>; folder: string }) {
  const input = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState<{ id: number; name: string; progress: number }[]>([]);
  const [drag, setDrag] = useState(false);

  async function handle(list: FileList | null) {
    const picked = Array.from(list || []);
    const media = picked.filter((f) => /^(image|video)\//.test(f.type));
    if (media.length < picked.length) toastError(new Error("Only images and videos can be added."));
    const room = MAX - files.length - uploading.length;
    if (media.length > room) toastError(new Error(`A design can hold up to ${MAX} files.`));
    await Promise.all(media.slice(0, Math.max(room, 0)).map(async (f) => {
      const id = Math.random();
      setUploading((u) => [...u, { id, name: f.name, progress: 0 }]);
      try {
        const url = await uploadFile(f, folder, (p) => setUploading((u) => u.map((x) => (x.id === id ? { ...x, progress: p } : x))));
        // Uploads finish in any order — append to the latest list, not this render's.
        onChange((fs) => [...fs, { slot:"", url, name: f.name, kind: f.type.startsWith("video/") ? "video" : "image" }]);
      } catch (e) {
        toastError(e);
      } finally {
        setUploading((u) => u.filter((x) => x.id !== id));
      }
    }));
  }

  const update = (i: number, patch: Partial<AssetFile>) => onChange((fs) => fs.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));

  return (
    <div className="mb-3">
      <p className="mb-1 text-xs font-semibold">Images <span className="font-normal text-muted">· {files.length}/{MAX}</span></p>
      {(files.length > 0 || uploading.length > 0) && (
        <div className="mb-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {files.map((f, i) => (
            <div key={f.url} className="overflow-hidden rounded-lg border border-line">
              <div className="relative aspect-[3/4] bg-panel2">
                {f.kind === "video"
                  ? <video src={f.url} className="h-full w-full object-cover" muted playsInline controls />
                  // eslint-disable-next-line @next/next/no-img-element -- user uploads on an arbitrary R2 domain
                  : <img src={f.url} alt={f.slot || f.name} className="h-full w-full object-cover" />}
                <button type="button" aria-label={`Remove ${f.slot || f.name}`} onClick={() => onChange((fs) => fs.filter((_, idx) => idx !== i))}
                  className="absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white hover:bg-danger">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <input className="input !rounded-none !border-0 !border-t !border-line !py-1.5 !text-xs" value={f.slot}
                onChange={(e) => update(i, { slot: e.target.value })} placeholder="Title, e.g. Front" aria-label="Image title" />
            </div>
          ))}
          {uploading.map((u) => (
            <div key={u.id} className="flex aspect-[3/4] flex-col items-center justify-center gap-1.5 rounded-lg border border-line bg-panel2 px-2 text-xs font-semibold text-accent">
              <LoaderCircle className="h-6 w-6 animate-spin" />{u.progress}%
              <span className="w-full truncate text-center text-[0.625rem] font-normal text-muted">{u.name}</span>
            </div>
          ))}
        </div>
      )}
      {files.length + uploading.length < MAX && (
        <div
          onClick={() => input.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handle(e.dataTransfer.files); }}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-2 py-5 text-center text-muted transition-colors ${
            drag ? "border-accent bg-accent-soft" : "border-line hover:border-accent hover:bg-accent-soft/40"
          }`}>
          <ImagePlus className="h-5 w-5" />
          <span className="text-xs font-semibold">Tap or drop files to upload</span>
          <span className="flex items-center gap-1 text-[0.625rem]"><FileVideoCamera className="h-3 w-3" />images or videos · you can pick several</span>
          <input ref={input} type="file" accept="image/*,video/*" multiple className="hidden" onChange={(e) => { handle(e.target.files); e.target.value = ""; }} />
        </div>
      )}
    </div>
  );
}
