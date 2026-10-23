"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Blocks, FolderKanban, Images, Plus, Settings2, Trash, X } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TypeIcon, { TYPE_ICONS } from "@/components/ui/TypeIcon";
import { EmptyState, Field, PageHeader, PageIcon, SearchInput, TableSkeleton } from "@/components/ui/bits";
import { api, refresh, useMe, useTypes } from "@/lib/client";
import { confirmDialog, promptDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { STEP_KINDS, uid, type StepKind, type StepTemplate } from "@/lib/workflow";
import type { ProductTypeDoc } from "@/lib/types";

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={`relative h-5 w-9 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-line"}`}>
      <span className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${on ? "translate-x-4" : ""}`} />
    </button>
  );
}

function EditTypeModal({ type, onClose }: { type: ProductTypeDoc; onClose: () => void }) {
  const [name, setName] = useState(type.name);
  const [icon, setIcon] = useState(type.icon);
  const [special, setSpecial] = useState(type.special);
  const [assetTab, setAssetTab] = useState(type.assetTab);
  const [modules, setModules] = useState(!!type.modules);
  const [slots, setSlots] = useState<string[]>(type.assetSlots?.length ? type.assetSlots : ["Cover", "Front", "Back"]);
  const [slotDraft, setSlotDraft] = useState("");
  const [steps, setSteps] = useState<StepTemplate[]>(type.steps || []);
  const [saving, setSaving] = useState(false);

  const updateStep = (id: string, patch: Partial<StepTemplate>) => setSteps((s) => s.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const move = (i: number, d: number) => setSteps((s) => {
    const n = [...s];
    if (i + d < 0 || i + d >= n.length) return s;
    [n[i], n[i + d]] = [n[i + d], n[i]];
    return n;
  });

  async function save() {
    setSaving(true);
    try {
      await api(`/api/product-types/${type._id}`, { method: "PUT", body: { name, icon, special, assetTab, modules, assetSlots: slots, steps } });
      toast.success("Product type saved. New projects will use this template.");
      refresh("/api/product-types");
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" title={`Edit ${type.name}`} icon={<TypeIcon icon={icon} />}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !name.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
      <Field label="Name"><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></Field>

      <Field label="Icon">
        <div className="flex flex-wrap gap-1">
          {Object.entries(TYPE_ICONS).map(([k, Icon]) => (
            <button key={k} type="button" onClick={() => setIcon(k)} aria-label={k}
              className={`flex h-7 w-7 items-center justify-center rounded-md border ${icon === k ? "border-accent bg-accent text-[var(--accent-fg)]" : "border-line text-muted hover:text-fg"}`}>
              <Icon className="h-3.5 w-3.5" />
            </button>
          ))}
        </div>
      </Field>

      <div className="mb-3 grid gap-1.5 sm:grid-cols-2">
        <label className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
          <FolderKanban className="h-4 w-4 text-accent" />
          <span className="flex-1"><span className="block text-[0.8125rem] font-semibold">Own Projects tab</span><span className="text-[0.6875rem] text-muted">Special type — not mixed into “Others”</span></span>
          <Switch on={special} onChange={setSpecial} label="Own Projects tab" />
        </label>
        <label className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
          <Images className="h-4 w-4 text-accent" />
          <span className="flex-1"><span className="block text-[0.8125rem] font-semibold">Asset tab</span><span className="text-[0.6875rem] text-muted">A design library under Assets</span></span>
          <Switch on={assetTab} onChange={setAssetTab} label="Asset tab" />
        </label>
        <label className="flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2 sm:col-span-2">
          <Blocks className="h-4 w-4 text-accent" />
          <span className="flex-1"><span className="block text-[0.8125rem] font-semibold">Modules (IT projects)</span><span className="text-[0.6875rem] text-muted">Group a project&apos;s tasks into modules — pages, parts or sections of an app or website</span></span>
          <Switch on={modules} onChange={setModules} label="Modules" />
        </label>
      </div>

      {assetTab && (
        <Field label="Image slots for each design" help="e.g. Cover, Front, Back. Each design in the library gets one upload box per slot.">
          <div className="flex flex-wrap items-center gap-1.5">
            {slots.map((s) => (
              <span key={s} className="chip bg-panel2 !py-1">{s}<button onClick={() => setSlots(slots.filter((x) => x !== s))} aria-label={`Remove ${s}`}><X className="h-3 w-3" /></button></span>
            ))}
            <input className="input !w-32 !py-1 !text-xs" placeholder="+ Add slot" value={slotDraft} onChange={(e) => setSlotDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && slotDraft.trim() && !slots.includes(slotDraft.trim())) { setSlots([...slots, slotDraft.trim()]); setSlotDraft(""); } }} />
          </div>
        </Field>
      )}

      <div className="mb-1 flex items-center justify-between">
        <p className="label !mb-0">Project template — steps</p>
        <span className="text-[0.6875rem] text-muted">Changes apply to new projects</span>
      </div>
      <div className="overflow-hidden rounded-lg border border-line">
        <div className="hidden grid-cols-[20px_minmax(0,1fr)_150px_minmax(0,1fr)_84px] gap-1.5 border-b border-line bg-panel2/60 px-2 py-1.5 text-[0.6875rem] font-semibold text-muted uppercase sm:grid">
          <span>#</span><span>Step</span><span>Kind</span><span>Tip for the team</span><span />
        </div>
        {steps.map((s, i) => (
          <div key={s.id} className="grid grid-cols-[20px_minmax(0,1fr)_84px] items-center gap-1.5 border-b border-line/70 px-2 py-1.5 last:border-0 sm:grid-cols-[20px_minmax(0,1fr)_150px_minmax(0,1fr)_84px]">
            <span className="text-xs font-bold text-muted">{i + 1}</span>
            <input className="input" value={s.title} onChange={(e) => updateStep(s.id, { title: e.target.value })} placeholder="Step name" />
            <select className="input col-start-2 row-start-2 sm:col-start-auto sm:row-start-auto" value={s.kind} onChange={(e) => updateStep(s.id, { kind: e.target.value as StepKind })}>
              {(Object.keys(STEP_KINDS) as StepKind[]).map((k) => <option key={k} value={k}>{STEP_KINDS[k].label}</option>)}
            </select>
            <input className="input col-start-2 row-start-3 sm:col-start-auto sm:row-start-auto" value={s.hint || ""} onChange={(e) => updateStep(s.id, { hint: e.target.value })} placeholder="Optional tip" />
            <span className="col-start-3 row-start-1 flex justify-end sm:col-start-auto sm:row-start-auto">
              <button className="icon-btn !h-7 !w-7" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Move up"><ArrowUp className="h-3.5 w-3.5" /></button>
              <button className="icon-btn !h-7 !w-7" onClick={() => move(i, 1)} disabled={i === steps.length - 1} aria-label="Move down"><ArrowDown className="h-3.5 w-3.5" /></button>
              <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => setSteps(steps.filter((x) => x.id !== s.id))} aria-label="Remove step"><Trash className="h-3.5 w-3.5" /></button>
            </span>
          </div>
        ))}
        {!steps.length && <p className="px-3 py-3 text-center text-xs text-muted">No steps = projects of this type are tracked with tasks only.</p>}
      </div>
      <button className="btn-soft btn-sm mt-1.5" onClick={() => setSteps([...steps, { id: uid(), title: "", kind: "check", hint: "" }])}><Plus className="h-3 w-3" />Add step</button>
    </Modal>
  );
}

export default function ProductTypesPage() {
  const { data: me } = useMe();
  const { data: types, isLoading } = useTypes();
  const [editing, setEditing] = useState<ProductTypeDoc | null>(null);
  const [q, setQ] = useState("");

  async function quickToggle(t: ProductTypeDoc, field: "special" | "assetTab" | "modules", value: boolean) {
    try {
      await api(`/api/product-types/${t._id}`, { method: "PUT", body: { [field]: value } });
      await refresh("/api/product-types");
      toast.success(
        field === "special" ? (value ? `${t.name} now has its own Projects tab.` : `${t.name} moved to “Others”.`)
        : field === "modules" ? (value ? `${t.name} projects now group tasks into modules.` : `${t.name} projects show one plain step list.`)
        : (value ? `${t.name} designs tab added to Assets.` : `${t.name} removed from Assets.`),
      );
    } catch (e) {
      toastError(e);
    }
  }

  async function add() {
    const name = await promptDialog("Name of the new product type", { placeholder: "e.g. Standee", confirmLabel: "Create", required: true });
    if (!name) return;
    try {
      const t = await api<ProductTypeDoc>("/api/product-types", { body: { name } });
      await refresh("/api/product-types");
      setEditing(t);
    } catch (e) {
      toastError(e);
    }
  }

  async function remove(t: ProductTypeDoc) {
    if (!(await confirmDialog(`Delete “${t.name}”?`, { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/product-types/${t._id}`, { method: "DELETE" });
      refresh("/api/product-types");
      toast.success("Product type deleted.");
    } catch (e) {
      toastError(e);
    }
  }

  if (me && me.role !== "admin") return <div className="card"><EmptyState title="Admins only" hint="Ask an admin to change product types." /></div>;

  const list = (types || []).filter((t) => t.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Product Types" subtitle="Choose which types get their own Projects tab or an Assets library, and edit their step templates."
        icon={<PageIcon><Settings2 /></PageIcon>}
        actions={<button className="btn-primary" onClick={add}><Plus className="h-3.5 w-3.5" />New type</button>} />
      <div className="mb-3"><SearchInput value={q} onChange={setQ} placeholder="Search types…" /></div>

      {isLoading && !types ? <TableSkeleton /> : (
        <div className="card overflow-x-auto !p-0">
          <table className="tbl">
            <thead>
              <tr>
                <th>Type</th>
                <th className="!text-center">Projects tab</th>
                <th className="!text-center">Asset tab</th>
                <th className="!text-center">Modules</th>
                <th className="hidden sm:table-cell">Template</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {list.map((t) => (
                <tr key={t._id}>
                  <td>
                    <button className="flex min-w-0 items-center gap-2 text-left font-semibold hover:text-accent" onClick={() => setEditing(t)}>
                      <TypeIcon icon={t.icon} size="sm" /><span className="truncate">{t.name}</span>
                    </button>
                  </td>
                  <td><span className="flex justify-center"><Switch on={t.special} onChange={(v) => quickToggle(t, "special", v)} label={`${t.name} projects tab`} /></span></td>
                  <td><span className="flex justify-center"><Switch on={t.assetTab} onChange={(v) => quickToggle(t, "assetTab", v)} label={`${t.name} asset tab`} /></span></td>
                  <td><span className="flex justify-center"><Switch on={!!t.modules} onChange={(v) => quickToggle(t, "modules", v)} label={`${t.name} modules`} /></span></td>
                  <td className="hidden text-xs text-muted sm:table-cell">{t.steps.length ? `${t.steps.length} steps` : "Tasks only"}</td>
                  <td className="w-24 !px-1">
                    <div className="flex justify-end gap-0.5">
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(t)}>Edit</button>
                      <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={() => remove(t)} aria-label={`Delete ${t.name}`}><Trash className="h-3.5 w-3.5" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {editing && <EditTypeModal key={editing._id} type={editing} onClose={() => setEditing(null)} />}
    </>
  );
}
