"use client";

import { createElement, useEffect, useState } from "react";
import {
  ChevronLeft, ChevronRight, Download, ExternalLink, File as FileIcon, FileArchive, FileAudio, FileImage, FileSpreadsheet,
  FileText, FileVideo, Palette, Pencil, Presentation, Star, Trash, type LucideIcon,
} from "lucide-react";
import FileDropZone from "@/components/mediaTools/FileDropZone";
import Modal from "@/components/ui/Modal";
import { ProgressBar } from "@/components/ui/bits";
import { api, fmtDate, refresh, timeAgo, uploadFile, useApi, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { browserCanShow, extOf, fileKind, fileLabel, fmtSize, type FileKind, type ProjectFile } from "@/lib/files";
import { makeThumb } from "@/lib/fileThumbs";

const KIND_ICON: Record<FileKind, LucideIcon> = {
  image: FileImage, video: FileVideo, audio: FileAudio, pdf: FileText, text: FileText,
  office: FileText, design: Palette, archive: FileArchive, other: FileIcon,
};

/** The icon for a file type, as an element (picked from a fixed table, not created per render). */
function KindIcon({ f, className, strokeWidth }: { f: Pick<ProjectFile, "kind" | "name">; className: string; strokeWidth: number }) {
  const ext = extOf(f.name);
  const props = { className, strokeWidth };
  if (["xls", "xlsx", "csv"].includes(ext)) return <FileSpreadsheet {...props} />;
  if (["ppt", "pptx"].includes(ext)) return <Presentation {...props} />;
  return createElement(KIND_ICON[f.kind], props);
}

/** Thumbnail, the image itself, or a big type icon with the extension. */
function Thumb({ f, className = "" }: { f: ProjectFile; className?: string }) {
  const src = f.thumb || (f.kind === "image" && browserCanShow(f) ? f.url : null);
  if (src) {
    // eslint-disable-next-line @next/next/no-img-element -- user uploads on the R2 domain
    return <img src={src} alt={f.name} loading="lazy" className={`h-full w-full object-cover ${className}`} />;
  }
  return (
    <span className={`flex h-full w-full flex-col items-center justify-center gap-1 text-muted ${className}`}>
      <KindIcon f={f} className="h-8 w-8" strokeWidth={1.6} />
      <span className="text-[0.625rem] font-bold tracking-wider uppercase">{extOf(f.name) || f.kind}</span>
    </span>
  );
}

/** Click the title to edit it; Enter saves, Esc cancels. Untitled files show their file name, greyed. */
function TitleEdit({ f, onSave, big = false }: { f: ProjectFile; onSave: (title: string) => void; big?: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const text = big ? "text-[0.9375rem]" : "text-[0.8125rem]";

  function commit() {
    setEditing(false);
    if (value.trim() !== (f.title || "")) onSave(value.trim());
  }

  if (editing) {
    return (
      <input autoFocus className={`input !py-1 ${text}`} value={value} placeholder={`Title — e.g. Final cover, Hindi version`} maxLength={200}
        onChange={(e) => setValue(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") commit();
          if (e.key === "Escape") setEditing(false);
        }} />
    );
  }
  return (
    <button className="group/title flex w-full min-w-0 items-center gap-1 text-left" title={f.title ? "Edit title" : "Add a title"}
      onClick={() => { setValue(f.title || ""); setEditing(true); }}>
      <span className={`truncate font-semibold ${text} ${f.title ? "" : "text-muted"}`}>{fileLabel(f)}</span>
      <Pencil className="h-3 w-3 shrink-0 text-muted opacity-0 transition-opacity group-hover/title:opacity-100" />
    </button>
  );
}

type Upload = { id: number; name: string; pct: number };
let nextUpload = 1;

export default function FilesPanel({ projectId }: { projectId: string }) {
  const { data: me } = useMe();
  const { data: files, mutate } = useApi<ProjectFile[]>(`/api/projects/${projectId}/files`);
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [asFinal, setAsFinal] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [open, setOpen] = useState<number | null>(null);
  const list = files || [];
  const canRemove = (f: ProjectFile) => me?.role === "admin" || me?.id === f.createdBy;

  async function upload(picked: File[]) {
    let added = 0;
    // One title for the batch; several files get "Title 1", "Title 2"…
    const base = newTitle.trim();
    for (const [i, file] of picked.entries()) {
      const title = base && picked.length > 1 ? `${base} ${i + 1}` : base;
      const id = nextUpload++;
      setUploads((u) => [...u, { id, name: file.name, pct: 0 }]);
      const progress = (pct: number) => setUploads((u) => u.map((x) => (x.id === id ? { ...x, pct } : x)));
      try {
        const thumbFile = await makeThumb(file);
        const url = await uploadFile(file, "projects", progress);
        const kind = fileKind(file.name, file.type);
        // SVGs draw as-is, so the file is its own thumbnail.
        const thumb = thumbFile ? await uploadFile(thumbFile, "thumbs") : kind === "image" && extOf(file.name) === "svg" ? url : null;
        await api(`/api/projects/${projectId}/files`, { body: { title, name: file.name, url, thumb, mime: file.type, size: file.size, final: asFinal } });
        added++;
        await mutate();
      } catch (e) {
        toastError(e);
      } finally {
        setUploads((u) => u.filter((x) => x.id !== id));
      }
    }
    if (!added) return;
    setNewTitle("");
    toast.success(added === 1 ? "File added." : `${added} files added.`);
    refresh("/api/projects?");
  }

  async function setTitle(f: ProjectFile, title: string) {
    try {
      await api(`/api/projects/${projectId}/files/${f._id}`, { method: "PATCH", body: { title } });
      await mutate();
      refresh("/api/projects?");
    } catch (e) {
      toastError(e);
    }
  }

  async function setFinal(f: ProjectFile, final: boolean) {
    try {
      await api(`/api/projects/${projectId}/files/${f._id}`, { method: "PATCH", body: { final } });
      await mutate();
      refresh("/api/projects?");
    } catch (e) {
      toastError(e);
    }
  }

  async function remove(f: ProjectFile) {
    if (!(await confirmDialog(`Remove “${fileLabel(f)}”?`, { danger: true, confirmLabel: "Remove file", detail: "It disappears from this project for everyone." }))) return;
    try {
      await api(`/api/projects/${projectId}/files/${f._id}`, { method: "DELETE" });
      setOpen(null);
      await mutate();
      refresh("/api/projects?");
    } catch (e) {
      toastError(e);
    }
  }

  const finals = list.filter((f) => f.final).length;

  return (
    <section className="mt-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h2 className="text-sm font-extrabold">Artwork & files</h2>
        {list.length > 0 && <span className="text-xs font-semibold text-muted">{finals ? `${finals} final · ` : ""}{list.length} file{list.length === 1 ? "" : "s"}</span>}
      </div>
      <div className="card !p-3">
        <FileDropZone accept="" onFiles={upload} label="Drop artwork here, or click to browse" hint="Any file — images, videos, PDFs, AI/PSD, Office, ZIP… up to 500 MB each." />
        <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center">
          <input className="input !py-1.5 sm:max-w-72" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} maxLength={200}
            placeholder="Title for the next upload (optional)" aria-label="Title for the next upload" />
          <label className="flex w-fit cursor-pointer items-center gap-2 text-xs font-semibold text-muted">
            <input type="checkbox" className="accent-accent" checked={asFinal} onChange={(e) => setAsFinal(e.target.checked)} />
            Mark new uploads as final artwork
          </label>
        </div>

        {uploads.length > 0 && (
          <div className="mt-3 space-y-1.5">
            {uploads.map((u) => (
              <div key={u.id} className="flex items-center gap-2 text-xs">
                <span className="w-40 truncate font-medium">{u.name}</span>
                <ProgressBar value={u.pct} className="flex-1" />
                <span className="w-9 text-right text-muted tabular-nums">{u.pct}%</span>
              </div>
            ))}
          </div>
        )}

        {list.length > 0 && (
          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-4">
            {list.map((f, i) => (
              <div key={f._id} className="group relative overflow-hidden rounded-2xl border border-line bg-panel">
                <button className="block aspect-[4/3] w-full overflow-hidden bg-panel2" onClick={() => setOpen(i)} aria-label={`Preview ${fileLabel(f)}`}>
                  <Thumb f={f} className="transition-transform duration-300 group-hover:scale-[1.03]" />
                </button>
                {f.final && <span className="chip absolute top-2 left-2 bg-accent text-white shadow"><Star className="h-3 w-3 fill-current" />Final</span>}
                <div className="px-2.5 py-2">
                  <TitleEdit f={f} onSave={(t) => setTitle(f, t)} />
                  <p className="truncate text-[0.6875rem] text-muted" title={f.name}>{[f.title && f.name, fmtSize(f.size), f.createdByName, timeAgo(f.createdAt)].filter(Boolean).join(" · ")}</p>
                </div>
                <div className="absolute top-2 right-2 flex gap-1 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                  <button className="icon-btn glass !h-7 !w-7" onClick={() => setFinal(f, !f.final)} aria-label={f.final ? "Unmark final" : "Mark as final"} title={f.final ? "Unmark final" : "Mark as final artwork"}>
                    <Star className={`h-3.5 w-3.5 ${f.final ? "fill-current text-accent" : ""}`} />
                  </button>
                  <a className="icon-btn glass !h-7 !w-7" href={f.url} target="_blank" rel="noreferrer" download aria-label="Download"><Download className="h-3.5 w-3.5" /></a>
                </div>
              </div>
            ))}
          </div>
        )}
        {files && !list.length && !uploads.length && <p className="mt-3 text-center text-xs text-muted">No files yet. Final artwork you add here shows on the project list too.</p>}
      </div>

      {open !== null && list[open] && (
        <FilePreview files={list} index={open} onIndex={setOpen} onClose={() => setOpen(null)}
          onFinal={setFinal} onTitle={setTitle} onRemove={remove} canRemove={canRemove(list[open])} />
      )}
    </section>
  );
}

function FilePreview({ files, index, onIndex, onClose, onFinal, onTitle, onRemove, canRemove }: {
  files: ProjectFile[];
  index: number;
  onIndex: (i: number) => void;
  onClose: () => void;
  onFinal: (f: ProjectFile, final: boolean) => void;
  onTitle: (f: ProjectFile, title: string) => void;
  onRemove: (f: ProjectFile) => void;
  canRemove: boolean;
}) {
  const f = files[index];
  const many = files.length > 1;
  const go = (d: number) => onIndex((index + d + files.length) % files.length);

  useEffect(() => {
    if (!many) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") onIndex((index + 1) % files.length);
      if (e.key === "ArrowLeft") onIndex((index - 1 + files.length) % files.length);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [many, index, files.length, onIndex]);

  return (
    <Modal open onClose={onClose} size="xl" title={fileLabel(f)}
      subtitle={`${[f.title && f.name, fmtSize(f.size), extOf(f.name).toUpperCase()].filter(Boolean).join(" · ")} · Added by ${f.createdByName} · ${fmtDate(f.createdAt)}${many ? ` · ${index + 1} of ${files.length}` : ""}`}
      footer={<>
        {canRemove && <button className="btn-ghost mr-auto hover:!text-danger" onClick={() => onRemove(f)}><Trash className="h-3.5 w-3.5" />Remove</button>}
        <button className="btn-ghost" onClick={() => onFinal(f, !f.final)}><Star className={`h-3.5 w-3.5 ${f.final ? "fill-current text-accent" : ""}`} />{f.final ? "Final artwork" : "Mark as final"}</button>
        <a className="btn-ghost" href={f.url} target="_blank" rel="noreferrer"><ExternalLink className="h-3.5 w-3.5" />Open</a>
        <a className="btn-primary" href={f.url} target="_blank" rel="noreferrer" download><Download className="h-3.5 w-3.5" />Download</a>
      </>}>
      <div className="mb-2 flex items-center gap-2">
        <span className="shrink-0 text-xs font-semibold text-muted">Title</span>
        <div className="min-w-0 flex-1"><TitleEdit key={f._id} f={f} big onSave={(t) => onTitle(f, t)} /></div>
      </div>
      <div className="relative">
        {/* key: a fresh viewer per file (stops the previous video, resets the Office toggle). */}
        <PreviewBody key={f._id} f={f} />
        {many && (
          <>
            <button className="glass absolute top-1/2 left-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full" onClick={() => go(-1)} aria-label="Previous file"><ChevronLeft className="h-5 w-5" /></button>
            <button className="glass absolute top-1/2 right-2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full" onClick={() => go(1)} aria-label="Next file"><ChevronRight className="h-5 w-5" /></button>
          </>
        )}
      </div>
    </Modal>
  );
}

const FRAME = "flex min-h-[240px] items-center justify-center overflow-hidden rounded-2xl bg-panel2";

/** Best available viewer for each kind of file. */
function PreviewBody({ f }: { f: ProjectFile }) {
  const [office, setOffice] = useState(false);

  if (f.kind === "image" && browserCanShow(f)) {
    // eslint-disable-next-line @next/next/no-img-element -- user uploads on the R2 domain
    return <div className={FRAME}><img src={f.url} alt={f.name} className="max-h-[68dvh] w-auto object-contain" /></div>;
  }
  if (f.kind === "video") {
    return <div className={FRAME}><video src={f.url} poster={f.thumb || undefined} controls playsInline className="max-h-[68dvh] w-full bg-black" /></div>;
  }
  if (f.kind === "audio") {
    return <div className={`${FRAME} flex-col gap-4 p-6`}><FileAudio className="h-12 w-12 text-muted" strokeWidth={1.4} /><audio src={f.url} controls className="w-full max-w-md" /></div>;
  }
  if (f.kind === "pdf") {
    // The browser's own PDF viewer: every page, zoom, search.
    return <iframe src={f.url} title={f.name} className="h-[68dvh] w-full rounded-2xl border border-line bg-white" />;
  }
  if (f.kind === "text") {
    // Sandboxed: shows text, never runs anything inside the file.
    return <iframe src={f.url} title={f.name} sandbox="" className="h-[60dvh] w-full rounded-2xl border border-line bg-white" />;
  }
  if (f.kind === "office") {
    return office ? (
      <iframe src={`https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(f.url)}`} title={f.name} className="h-[68dvh] w-full rounded-2xl border border-line bg-white" />
    ) : (
      <div className={`${FRAME} flex-col gap-3 p-6 text-center`}>
        <KindIcon f={f} className="h-12 w-12 text-muted" strokeWidth={1.4} />
        <p className="text-sm font-semibold">{f.name}</p>
        <p className="max-w-sm text-xs text-muted">Word, Excel and PowerPoint files open in Microsoft&apos;s free online viewer (it reads the file from its link).</p>
        <button className="btn-soft btn-sm" onClick={() => setOffice(true)}><ExternalLink className="h-3.5 w-3.5" />Preview with Office viewer</button>
      </div>
    );
  }
  if (f.thumb) {
    // e.g. Illustrator files saved PDF-compatible: page 1 rendered at upload.
    return (
      <div className={`${FRAME} flex-col gap-2 p-3`}>
        {/* eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail */}
        <img src={f.thumb} alt={f.name} className="max-h-[62dvh] w-auto rounded-lg object-contain shadow" />
        <p className="text-[0.6875rem] text-muted">Preview of the first page — download for the full {extOf(f.name).toUpperCase()} file.</p>
      </div>
    );
  }
  return (
    <div className={`${FRAME} flex-col gap-2 p-6 text-center`}>
      <KindIcon f={f} className="h-12 w-12 text-muted" strokeWidth={1.4} />
      <p className="text-sm font-semibold">{f.name}</p>
      <p className="text-xs text-muted">
        {f.kind === "design" ? "Open it in its design app — download it below." : f.kind === "archive" ? "A compressed folder — download it to open." : "No preview for this kind of file — download it to open."}
      </p>
    </div>
  );
}
