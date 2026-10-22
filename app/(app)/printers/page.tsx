"use client";

import { useMemo, useState } from "react";
import { Copy, Mail, Pencil, Plus, Printer as PrinterIcon, Trash } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { EmptyState, Field, PageHeader, PageIcon, SearchInput, SortTh, TableSkeleton, useSort } from "@/components/ui/bits";
import { api, refresh, usePrinters } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { Printer } from "@/lib/types";

const FIELDS = [
  { key: "printerType", label: "Printer type", placeholder: "Digital print" },
  { key: "pageColor", label: "Color mode", placeholder: "CMYK" },
  { key: "fileType", label: "File type needed", placeholder: "PDF" },
  { key: "fileSize", label: "File size", placeholder: "13x19 / 12x18" },
  { key: "pageType", label: "Paper", placeholder: "210 GSM / 170 GSM" },
] as const;

type Form = { name: string; email_id: string } & Record<(typeof FIELDS)[number]["key"], string>;
const EMPTY: Form = { name: "", email_id: "", printerType: "", pageColor: "", fileType: "", fileSize: "", pageType: "" };

export default function PrintersPage() {
  const { data: printers, isLoading } = usePrinters();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(EMPTY);
  const [saving, setSaving] = useState(false);

  const list = useMemo(() => (printers || []).filter((p) => [p.name, p.email_id, p.printerType].some((v) => v?.toLowerCase().includes(q.toLowerCase()))), [printers, q]);
  const { sorted, sort, toggle } = useSort(list, Object.fromEntries([["name", (p: Printer) => p.name], ["email_id", (p: Printer) => p.email_id], ...FIELDS.map((f) => [f.key, (p: Printer) => p[f.key]])]));

  function openForm(p?: Printer) {
    setEdit(p?._id || null);
    setForm(p ? { name: p.name, email_id: p.email_id, printerType: p.printerType || "", pageColor: p.pageColor || "", fileType: p.fileType || "", fileSize: p.fileSize || "", pageType: p.pageType || "" } : EMPTY);
    setOpen(true);
  }

  async function save() {
    setSaving(true);
    try {
      await api(edit ? `/api/printers/${edit}` : "/api/printers", { method: edit ? "PUT" : "POST", body: form });
      toast.success(edit ? "Printer updated." : "Printer added.");
      refresh("/api/printers");
      setOpen(false);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Printer) {
    if (!(await confirmDialog(`Delete “${p.name}”?`, { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/printers/${p._id}`, { method: "DELETE" });
      refresh("/api/printers");
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <>
      <PageHeader title="Printer Types" subtitle="Where print jobs go, and the exact file each printer needs."
        icon={<PageIcon><PrinterIcon /></PageIcon>}
        actions={<button className="btn-primary" onClick={() => openForm()}><Plus className="h-3.5 w-3.5" />New printer</button>} />
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Search name, email, type…" /></div>

      {isLoading && !printers ? <TableSkeleton /> : list.length === 0 ? (
        <div className="card"><EmptyState icon={<PrinterIcon />} title={q ? "Nothing matches." : "No printers yet."}
          action={!q && <button className="btn-primary" onClick={() => openForm()}><Plus className="h-3.5 w-3.5" />New printer</button>} /></div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto !p-0 lg:block">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh label="Printer" k="name" sort={sort} onSort={toggle} />
                  <SortTh label="Email" k="email_id" sort={sort} onSort={toggle} />
                  {FIELDS.map((f) => <SortTh key={f.key} label={f.label} k={f.key} sort={sort} onSort={toggle} />)}
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <tr key={p._id}>
                    <td className="font-semibold">{p.name}</td>
                    <td>
                      <button className="flex items-center gap-1 text-muted hover:text-fg" title="Copy email" onClick={() => { navigator.clipboard.writeText(p.email_id); toast.success("Email copied."); }}>
                        {p.email_id}<Copy className="h-3 w-3" />
                      </button>
                    </td>
                    {FIELDS.map((f) => <td key={f.key} className="max-w-48 text-muted">{p[f.key] || "—"}</td>)}
                    <td>
                      <div className="flex justify-end gap-1">
                        <a href={`mailto:${p.email_id}`} className="icon-btn !h-7 !w-7" aria-label={`Email ${p.name}`}><Mail className="h-3.5 w-3.5" /></a>
                        <button className="icon-btn !h-7 !w-7" onClick={() => openForm(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => remove(p)} aria-label={`Delete ${p.name}`}><Trash className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden !p-0 lg:hidden">
            {sorted.map((p) => (
              <div key={p._id} className="border-b border-line/70 px-3 py-2 last:border-0">
                <div className="flex items-center gap-2">
                  <p className="min-w-0 flex-1 truncate text-[13px] font-semibold">{p.name}</p>
                  <a href={`mailto:${p.email_id}`} className="icon-btn !h-7 !w-7" aria-label={`Email ${p.name}`}><Mail className="h-3.5 w-3.5" /></a>
                  <button className="icon-btn !h-7 !w-7" onClick={() => openForm(p)} aria-label={`Edit ${p.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                </div>
                <p className="truncate text-[11px] text-muted">{[p.email_id, p.printerType, p.pageColor, p.fileType].filter(Boolean).join(" · ")}</p>
                {(p.fileSize || p.pageType) && <p className="truncate text-[11px] text-muted">{[p.fileSize, p.pageType].filter(Boolean).join(" · ")}</p>}
              </div>
            ))}
          </div>
        </>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title={edit ? "Edit printer" : "New printer"}
        footer={<><button className="btn-ghost" onClick={() => setOpen(false)}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !form.name.trim() || !form.email_id.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
        <Field label="Name"><input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus /></Field>
        <Field label="Email"><input type="email" className="input" value={form.email_id} onChange={(e) => setForm({ ...form, email_id: e.target.value })} /></Field>
        <div className="grid gap-x-2.5 sm:grid-cols-2">
          {FIELDS.map((f) => (
            <Field key={f.key} label={f.label} optional>
              <input className="input" value={form[f.key]} placeholder={f.placeholder} onChange={(e) => setForm({ ...form, [f.key]: e.target.value })} />
            </Field>
          ))}
        </div>
      </Modal>
    </>
  );
}
