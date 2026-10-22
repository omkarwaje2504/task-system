"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Download, Pencil, Trash } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field } from "@/components/ui/bits";
import SlotUploader from "./SlotUploader";
import { api, fmtDate, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { Asset, AssetFile, ProductTypeDoc } from "@/lib/types";

export function coverOf(a: Asset) {
  return a.files.find((f) => f.slot.toLowerCase() === "cover") || a.files[0];
}

export function AssetFormModal({ type, asset, onClose, onSaved }: { type: ProductTypeDoc; asset?: Asset; onClose: () => void; onSaved: () => void }) {
  const slots = type.assetSlots.length ? type.assetSlots : ["Cover", "Front", "Back"];
  const [title, setTitle] = useState(asset?.title || "");
  const [description, setDescription] = useState(asset?.description || "");
  const [tags, setTags] = useState((asset?.tags || []).join(", "));
  const [files, setFiles] = useState<AssetFile[]>(asset?.files || []);
  const [saving, setSaving] = useState(false);

  const setSlot = (slot: string, f: AssetFile | null) => setFiles((fs) => [...fs.filter((x) => x.slot !== slot), ...(f ? [f] : [])]);

  async function save() {
    setSaving(true);
    try {
      const body = { productType: type._id, title, description, tags: tags.split(",").map((t) => t.trim()).filter(Boolean), files };
      if (asset) await api(`/api/assets/${asset._id}`, { method: "PUT", body });
      else await api("/api/assets", { body });
      toast.success(asset ? "Design updated." : "Design added to the library.");
      onSaved();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={asset ? "Edit design" : `Add a ${type.name} design`}
      subtitle="Theme title + the images. Everything else is optional."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : asset ? "Save changes" : "Add design"}</button></>}>
      <Field label="Theme title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Floral 2027" autoFocus /></Field>
      <Field label="Description" optional><textarea className="input" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Colors, style, which client liked it…" /></Field>
      <div className="mb-3 grid grid-cols-3 gap-2">
        {slots.map((s) => <SlotUploader key={s} slot={s} folder={`assets-${type.slug}`} file={files.find((f) => f.slot === s)} onChange={(f) => setSlot(s, f)} />)}
      </div>
      <Field label="Tags" optional help="Separate with commas — helps search."><input className="input" value={tags} onChange={(e) => setTags(e.target.value)} placeholder="floral, pastel, pharma" /></Field>
    </Modal>
  );
}

export function AssetViewer({ asset, onClose, onEdit, onDeleted }: { asset: Asset; onClose: () => void; onEdit: () => void; onDeleted: () => void }) {
  const { data: me } = useMe();
  const [i, setI] = useState(0);
  const file = asset.files[i];
  const canManage = me?.role === "admin" || me?.id === asset.createdBy;

  async function remove() {
    if (!(await confirmDialog(`Delete “${asset.title}”?`, { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/assets/${asset._id}`, { method: "DELETE" });
      toast.success("Design deleted.");
      onDeleted();
      onClose();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <Modal open onClose={onClose} size="xl" title={asset.title} subtitle={`Added by ${asset.createdByName} · ${fmtDate(asset.createdAt)}`}
      footer={<>
        {canManage && <button className="btn-ghost mr-auto hover:!text-danger" onClick={remove}><Trash className="h-3.5 w-3.5" />Delete</button>}
        {file && <a className="btn-ghost" href={file.url} target="_blank" rel="noreferrer" download><Download className="h-3.5 w-3.5" />Download {file.slot}</a>}
        <button className="btn-primary" onClick={onEdit}><Pencil className="h-3.5 w-3.5" />Edit</button>
      </>}>
      {file ? (
        <div className="relative flex items-center justify-center overflow-hidden rounded-lg bg-panel2" style={{ minHeight: 240 }}>
          {file.kind === "video"
            ? <video src={file.url} controls className="max-h-[60dvh] w-auto" />
            // eslint-disable-next-line @next/next/no-img-element -- user uploads on an arbitrary R2 domain
            : <img src={file.url} alt={file.slot} className="max-h-[60dvh] w-auto object-contain" />}
          {asset.files.length > 1 && (
            <>
              <button className="absolute left-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white" onClick={() => setI((i - 1 + asset.files.length) % asset.files.length)} aria-label="Previous"><ChevronLeft className="h-5 w-5" /></button>
              <button className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-white" onClick={() => setI((i + 1) % asset.files.length)} aria-label="Next"><ChevronRight className="h-5 w-5" /></button>
            </>
          )}
          <span className="chip absolute top-2 left-2 bg-black/60 text-white">{file.slot}</span>
        </div>
      ) : <p className="rounded-lg bg-panel2 p-6 text-center text-xs text-muted">No images yet — press Edit to add them.</p>}

      {asset.files.length > 1 && (
        <div className="mt-2 flex gap-1.5 overflow-x-auto">
          {asset.files.map((f, idx) => (
            <button key={f.url} onClick={() => setI(idx)} className={`relative h-14 w-11 shrink-0 overflow-hidden rounded-md ring-2 ${idx === i ? "ring-accent" : "ring-transparent"}`}>
              {f.kind === "video" ? <video src={f.url} className="h-full w-full object-cover" muted /> : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={f.url} alt={f.slot} className="h-full w-full object-cover" />
              )}
              <span className="absolute inset-x-0 bottom-0 bg-black/60 text-[9px] font-bold text-white">{f.slot}</span>
            </button>
          ))}
        </div>
      )}
      {asset.description && <p className="mt-3 text-[13px] whitespace-pre-wrap">{asset.description}</p>}
      {asset.tags.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{asset.tags.map((t) => <span key={t} className="chip bg-panel2 text-muted">#{t}</span>)}</div>}
    </Modal>
  );
}
