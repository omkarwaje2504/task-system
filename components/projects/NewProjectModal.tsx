"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, ListChecks, Plus, Search } from "lucide-react";
import Modal from "@/components/ui/Modal";
import TypeIcon from "@/components/ui/TypeIcon";
import { Field } from "@/components/ui/bits";
import BrandCompanyFields from "./BrandCompanyFields";
import { api, refresh, todayISO, useTypes } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import { COMMON_LANGUAGES, STEP_KINDS } from "@/lib/workflow";
import type { ProductTypeDoc } from "@/lib/types";

const addDays = (n: number) => {
  const d = new Date(`${todayISO()}T00:00:00`);
  d.setDate(d.getDate() + n);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
};
const QUICK_DEADLINES = [
  { label: "In 3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
  { label: "1 month", days: 30 },
];

export default function NewProjectModal({ open, onClose, initialTypeSlug }: { open: boolean; onClose: () => void; initialTypeSlug?: string }) {
  const router = useRouter();
  const { data: types = [] } = useTypes();
  const initial = types.find((t) => t.slug === initialTypeSlug) || null;
  const [typeId, setTypeId] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(initial ? 2 : 1);
  const [q, setQ] = useState("");
  const [theme, setTheme] = useState("");
  const [company, setCompany] = useState("");
  const [brand, setBrand] = useState("");
  const [deadline, setDeadline] = useState("");
  const [languages, setLanguages] = useState<string[]>([]);
  const [customLang, setCustomLang] = useState("");
  const [notes, setNotes] = useState("");
  // Ask: start from the type's template steps, or with none (add tasks one by one).
  const [useTemplate, setUseTemplate] = useState(true);
  const [saving, setSaving] = useState(false);

  const type: ProductTypeDoc | null = types.find((t) => t._id === typeId) || initial;
  const hasLanguages = useTemplate && type?.steps.some((s) => s.kind === "languages");
  const special = types.filter((t) => t.special);
  const others = useMemo(() => types.filter((t) => !t.special && t.name.toLowerCase().includes(q.toLowerCase())), [types, q]);

  function choose(t: ProductTypeDoc) {
    setTypeId(t._id);
    setStep(2);
  }

  async function addType() {
    if (!q.trim()) return;
    try {
      const t = await api<ProductTypeDoc>("/api/product-types", { body: { name: q.trim() } });
      await refresh("/api/product-types");
      choose(t);
    } catch (e) {
      toastError(e);
    }
  }

  function toggleLang(l: string) {
    setLanguages((ls) => (ls.includes(l) ? ls.filter((x) => x !== l) : [...ls, l]));
  }

  async function create() {
    if (!type) return;
    setSaving(true);
    try {
      const p = await api<{ _id: string }>("/api/projects", {
        body: { productType: type._id, theme, companyName: company, brandName: brand, deadline: deadline || null, languages, notes, useTemplate },
      });
      toast.success(useTemplate && type.steps.length ? "Project created! Here are its steps." : "Project created! Add its tasks one by one.");
      refresh("/api/projects", "/api/dashboard", "/api/brands", "/api/companies");
      onClose();
      router.push(`/project/${p._id}`);
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} size="lg"
      title={step === 1 ? "What are we making?" : "Project details"}
      subtitle={step === 1 ? "Step 1 of 2 — pick the product type" : "Step 2 of 2 — only the product type is required"}
      footer={step === 2 && (
        <>
          <button className="btn-ghost mr-auto" onClick={() => setStep(1)}><ArrowLeft className="h-3.5 w-3.5" />Back</button>
          <button className="btn-primary" onClick={create} disabled={saving || !type}>
            {saving ? "Creating…" : <>Create project <ArrowRight className="h-3.5 w-3.5" /></>}
          </button>
        </>
      )}>
      {step === 1 ? (
        <div>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {special.map((t) => (
              <button key={t._id} onClick={() => choose(t)}
                className={`group flex items-center gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-accent hover:bg-accent-soft ${type?._id === t._id ? "border-accent bg-accent-soft" : "border-line"}`}>
                <TypeIcon icon={t.icon} size="md" />
                <div className="min-w-0">
                  <p className="truncate text-[0.8125rem] font-semibold">{t.name}</p>
                  <p className="text-[0.6875rem] text-muted">{t.steps.length ? `${t.steps.length} guided steps` : "Tasks only"}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="section-title mt-4 mb-1.5">Other product types</p>
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input className="input !pl-8" placeholder="Search or type a new one…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <div className="flex flex-wrap gap-1">
            {others.map((t) => (
              <button key={t._id} onClick={() => choose(t)} className="flex items-center gap-1.5 rounded-md border border-line py-1 pr-2 pl-1 text-xs font-semibold hover:border-accent hover:bg-accent-soft">
                <TypeIcon icon={t.icon} size="xs" />
                {t.name}
              </button>
            ))}
            {q.trim() && !types.some((t) => t.name.toLowerCase() === q.trim().toLowerCase()) && (
              <button onClick={addType} className="flex items-center gap-1 rounded-md border border-dashed border-accent px-2 py-1 text-xs font-semibold text-accent hover:bg-accent-soft">
                <Plus className="h-3.5 w-3.5" /> Add “{q.trim()}”
              </button>
            )}
          </div>
        </div>
      ) : type && (
        <div>
          <div className="mb-3 flex items-center gap-2.5 rounded-lg border border-line px-2.5 py-2">
            <TypeIcon icon={type.icon} />
            <div className="min-w-0 flex-1">
              <p className="text-[0.6875rem] text-muted">Product type</p>
              <p className="text-[0.8125rem] font-bold">{type.name}</p>
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setStep(1)}>Change</button>
          </div>

          <Field label="Theme" optional help="A short name for this job — e.g. “Diwali 2026”, “World Heart Day”.">
            <input className="input" value={theme} onChange={(e) => setTheme(e.target.value)} placeholder="e.g. World Heart Day" autoFocus />
          </Field>

          <BrandCompanyFields company={company} brand={brand} onCompany={setCompany} onBrand={setBrand} />

          <Field label="Deadline" optional>
            <div className="flex flex-wrap items-center gap-1">
              <input type="date" className="input !w-auto" value={deadline} min={todayISO()} onChange={(e) => setDeadline(e.target.value)} />
              {QUICK_DEADLINES.map((d) => (
                <button key={d.days} type="button" onClick={() => setDeadline(addDays(d.days))}
                  className={`rounded-md px-2 py-1 text-xs font-semibold ${deadline === addDays(d.days) ? "bg-accent text-[var(--accent-fg)]" : "bg-panel2 text-muted hover:text-fg"}`}>
                  {d.label}
                </button>
              ))}
            </div>
          </Field>

          {hasLanguages && (
            <Field label="Languages" optional help={languages.length ? `${languages.length} language${languages.length === 1 ? "" : "s"} — each gets a male & female video.` : "Leave empty for English only. You can change this later."}>
              <div className="flex flex-wrap gap-1">
                {[...new Set([...COMMON_LANGUAGES, ...languages])].map((l) => {
                  const on = languages.includes(l);
                  return (
                    <button key={l} type="button" onClick={() => toggleLang(l)}
                      className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${on ? "border-accent bg-accent text-[var(--accent-fg)]" : "border-line text-muted hover:text-fg"}`}>
                      {on && <Check className="h-3 w-3" />}{l}
                    </button>
                  );
                })}
                <input className="input !w-28 !py-0.5 !text-xs" placeholder="+ Other…" value={customLang}
                  onChange={(e) => setCustomLang(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && customLang.trim()) {
                      e.preventDefault();
                      toggleLang(customLang.trim());
                      setCustomLang("");
                    }
                  }} />
              </div>
            </Field>
          )}

          <Field label="Notes" optional>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Anything the team should know" />
          </Field>

          {type.steps.length > 0 ? (
            <div className={`overflow-hidden rounded-lg border ${useTemplate ? "border-accent/50" : "border-line"}`}>
              <label className="flex cursor-pointer items-start gap-2 border-b border-line bg-panel2/60 px-2.5 py-2">
                <input type="checkbox" className="mt-0.5 accent-accent" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} />
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5 text-xs font-bold"><ListChecks className="h-3.5 w-3.5 text-accent" />Use the {type.name} template ({type.steps.length} step{type.steps.length === 1 ? "" : "s"})</span>
                  <span className="block text-[0.6875rem] text-muted">{useTemplate ? "The project starts with these steps." : "Start empty — you'll add the tasks yourself, one by one."}</span>
                </span>
              </label>
              <ol className={useTemplate ? "" : "opacity-40"}>
                {type.steps.map((s, i) => (
                  <li key={s.id} className="flex items-center gap-2 border-b border-line/70 px-2.5 py-1.5 text-[0.8125rem] last:border-0">
                    <span className="w-4 shrink-0 text-xs font-bold text-muted">{i + 1}</span>
                    <span className="flex-1">{s.title}</span>
                    {s.kind !== "check" && <span className="chip bg-panel2 text-muted">{STEP_KINDS[s.kind].label}</span>}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="rounded-lg bg-panel2 px-3 py-2 text-xs text-muted">This product type has no step template — you&apos;ll track it with simple tasks.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
