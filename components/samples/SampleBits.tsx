"use client";

import { useState, type MouseEvent } from "react";
import { Hand, Shapes, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Field } from "@/components/ui/bits";
import Combobox from "@/components/ui/Combobox";
import TypeIcon from "@/components/ui/TypeIcon";
import BrandCompanyFields from "@/components/projects/BrandCompanyFields";
import { api, movedOffText, refresh, useMe, useTypes } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import { SAMPLE_STATUS, type SampleStatus } from "@/lib/samples";
import type { ProductTypeDoc, Project } from "@/lib/types";

export function SampleStatusChip({ status }: { status?: SampleStatus }) {
  const s = SAMPLE_STATUS[status || "requested"];
  return <span className={`chip ${s.cls}`}>{s.label}</span>;
}

export const sampleTitle = (p: Pick<Project, "brand" | "theme" | "type">) =>
  [p.brand?.name, p.theme].filter(Boolean).join(" — ") || `${p.type?.name || ""} sample`;

/** "I'm working" toggle: puts you on the sample (a requested sample moves to Working); click again to take the mark off. */
export function WorkingButton({ p, onDone }: { p: Project; onDone?: (next: Project) => void }) {
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  if (!me || !p.sample) return null;
  const onIt = (p.workers || []).includes(me.id);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      const next = await api<Project & { stopped?: string[] }>(`/api/samples/${p._id}`, { method: "PATCH", body: { working: !onIt } });
      toast.success(onIt ? "Cleared “I'm working” on this sample." : `You're working on this sample.${movedOffText(next.stopped)}`);
      onDone?.(next);
      refresh("/api/samples", "/api/projects", "/api/dashboard", "/api/steps");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button className={`${onIt ? "btn-primary" : "btn-soft"} btn-sm shrink-0`} onClick={toggle} disabled={busy} aria-pressed={onIt}
      title={onIt ? "You're working on this sample — click to clear" : "Mark that you're working on this sample"}>
      {onIt ? <><X className="h-3.5 w-3.5" />Uncheck</> : <><Hand className="h-3.5 w-3.5" />I&apos;m working</>}
    </button>
  );
}

/** New sample, or edit one: type, what it is, company / brand (optional), description. */
export function SampleFormModal({ sample, onClose, onSaved }: { sample?: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const { data: types = [] } = useTypes();
  // Typable: pick an existing type or type a new requirement (created on save).
  const [typeName, setTypeName] = useState(sample?.type?.name || "");
  const [theme, setTheme] = useState(sample?.theme || "");
  const [company, setCompany] = useState(sample?.company?.name || "");
  const [brand, setBrand] = useState(sample?.brand?.name || "");
  const [notes, setNotes] = useState(sample?.notes || "");
  const [saving, setSaving] = useState(false);
  const typeOptions = types.map((t) => ({ value: t._id, label: t.name, icon: <TypeIcon icon={t.icon} size="xs" /> }));

  async function save() {
    setSaving(true);
    try {
      const name = typeName.trim();
      const existing = types.find((t) => t.name.toLowerCase() === name.toLowerCase());
      // New requirement: the product types API creates it (or returns the match).
      const productType = existing?._id || (await api<ProductTypeDoc>("/api/product-types", { body: { name } }))._id;
      if (!existing) refresh("/api/product-types");
      const body = { productType, theme, companyName: company, brandName: brand, notes };
      const next = await api<Project>(sample ? `/api/samples/${sample._id}` : "/api/samples", { method: sample ? "PATCH" : "POST", body });
      toast.success(sample ? "Sample updated." : "Sample added.");
      refresh("/api/samples", "/api/brands", "/api/companies");
      onSaved(next);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title={sample ? "Edit sample" : "New sample"}
      subtitle={sample ? undefined : "A client asked for a sample. It isn't a project until you convert it."}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !typeName.trim()}>{saving ? "Saving…" : sample ? "Save changes" : "Add sample"}</button></>}>
      <Field label="Type" help="Pick one, or type a new requirement — it's added as a new type.">
        <Combobox value={typeName} onChange={setTypeName} options={typeOptions} newLabel="New type" placeholder="e.g. Frame, Standee, App…"
          icon={<Shapes className="h-4 w-4" />} autoFocus={!sample} />
      </Field>
      <Field label="What's the sample?" optional help="e.g. “Diwali frame — 2 options”, “App home screen”.">
        <input className="input" value={theme} onChange={(e) => setTheme(e.target.value)} />
      </Field>
      <BrandCompanyFields company={company} brand={brand} onCompany={setCompany} onBrand={setBrand} />
      <Field label="Description" optional>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What the client asked for, sizes, references…" />
      </Field>
    </Modal>
  );
}
