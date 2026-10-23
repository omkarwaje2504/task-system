"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building, CircleCheck, CirclePause, CirclePlay, Eye, EyeOff, ListPlus, Pencil, PartyPopper, Plus, SlidersHorizontal, Trash, type LucideIcon,
} from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import Modal from "@/components/ui/Modal";
import { DeadlineBadge, EmptyState, Field, ProgressRing, Skeleton } from "@/components/ui/bits";
import StepCard, { StepsHeader, type StepPatch } from "@/components/projects/StepCard";
import BrandCompanyFields from "@/components/projects/BrandCompanyFields";
import FilesPanel from "@/components/projects/FilesPanel";
import ModulesBoard, { GENERAL, moduleGroups } from "@/components/projects/ModulesBoard";
import { StarButton, projectTitle } from "@/components/projects/ProjectCard";
import { UserMultiSelect } from "@/components/ui/UserPicker";
import { api, fmtDate, refresh, useApi, useMe, useTypes } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { projectProgress, STEP_KINDS, stepPeople, type ProjectStep, type StepKind } from "@/lib/workflow";
import type { Project } from "@/lib/types";

type NewStep = { title: string; kind: StepKind; assignees: string[]; dueDate: string | null; note: string; module?: string };

const STATUS: { key: Project["status"]; label: string; icon: LucideIcon }[] = [
  { key: "active", label: "In progress", icon: CirclePlay },
  { key: "on-hold", label: "On hold", icon: CirclePause },
  { key: "completed", label: "Completed", icon: CircleCheck },
];

function EditProjectModal({ p, onClose, onSaved }: { p: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const { data: types = [] } = useTypes();
  const [typeId, setTypeId] = useState(p.type?._id || "");
  const [addTemplate, setAddTemplate] = useState(true);
  const [theme, setTheme] = useState(p.theme);
  const [company, setCompany] = useState(p.company?.name || "");
  const [brand, setBrand] = useState(p.brand?.name || "");
  const [deadline, setDeadline] = useState(p.deadline || "");
  const [notes, setNotes] = useState(p.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const next = await api<Project>(`/api/projects/${p._id}`, { method: "PUT", body: { theme, companyName: company, brandName: brand, deadline: deadline || null, notes, ...(typeId && typeId !== p.type?._id ? { productType: typeId, addTemplateSteps: addTemplate } : {}) } });
      toast.success("Project updated.");
      refresh("/api/brands", "/api/companies", "/api/projects?");
      onSaved(next);
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit project"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving}>{saving ? "Saving…" : "Save changes"}</button></>}>
      <Field label="Product type">
        <div className="flex items-center gap-2">
          <TypeIcon icon={types.find((t) => t._id === typeId)?.icon || p.type?.icon} size="md" />
          <select className="input" value={typeId} onChange={(e) => setTypeId(e.target.value)}>
            {!types.some((t) => t._id === typeId) && p.type && <option value={p.type._id}>{p.type.name}</option>}
            {types.map((t) => <option key={t._id} value={t._id}>{t.name}</option>)}
          </select>
        </div>
      </Field>
      {typeId && typeId !== p.type?._id && (() => {
        const t = types.find((x) => x._id === typeId);
        const have = new Set(p.steps.map((st) => st.title.trim().toLowerCase()));
        const extra = (t?.steps || []).filter((st) => !have.has(st.title.trim().toLowerCase()));
        return (
          <div className="mb-3 -mt-1 rounded-xl bg-panel2 px-3 py-2 text-xs">
            <p className="text-muted">This project&apos;s steps stay as they are.</p>
            {extra.length > 0 && (
              <label className="mt-1.5 flex cursor-pointer items-start gap-2 font-semibold">
                <input type="checkbox" className="mt-0.5 accent-accent" checked={addTemplate} onChange={(e) => setAddTemplate(e.target.checked)} />
                <span>Also add {t?.name}&apos;s {extra.length} template step{extra.length === 1 ? "" : "s"} <span className="font-normal text-muted">({extra.map((x) => x.title).join(", ")})</span></span>
              </label>
            )}
          </div>
        );
      })()}
      <Field label="Theme" optional><input className="input" value={theme} onChange={(e) => setTheme(e.target.value)} /></Field>
      <BrandCompanyFields company={company} brand={brand} onCompany={setCompany} onBrand={setBrand} />
      <Field label="Deadline" optional><input type="date" className="input !w-auto" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <Field label="Notes" optional><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}

/** Add a step, or edit one (`editing` set: the kind can't change, its panel keeps its data). */
function StepFormModal({ initial, editing = false, modules, onClose, onSave }: {
  initial?: Partial<NewStep>;
  editing?: boolean;
  /** IT projects: the project's modules, so the task can be put in one. */
  modules?: string[];
  onClose: () => void;
  onSave: (step: NewStep) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(initial?.title || "");
  const [kind, setKind] = useState<StepKind>(initial?.kind || "check");
  const [assignees, setAssignees] = useState<string[]>(initial?.assignees || []);
  const [dueDate, setDueDate] = useState(initial?.dueDate || "");
  const [note, setNote] = useState(initial?.note || "");
  const [module, setModule] = useState(initial?.module || "");
  const save = () => onSave({ title: title.trim(), kind, assignees, dueDate: dueDate || null, note, module }).then((ok) => ok && onClose());
  return (
    <Modal open onClose={onClose} title={editing ? "Edit step" : "Add a step"}
      subtitle={editing ? undefined : "Only for this project — the product type's template stays the same."}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!title.trim()} onClick={save}>{editing ? "Save changes" : "Add step"}</button></>}>
      <Field label="What needs to be done?"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Extra revision round" /></Field>
      {modules && (
        <Field label="Module" optional help="The page, part or section of the app / website this task belongs to.">
          <select className="input" value={module} onChange={(e) => setModule(e.target.value)}>
            <option value="">{GENERAL}</option>
            {modules.map((m) => <option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      )}
      <Field label="Who's doing it?" optional><UserMultiSelect value={assignees} onChange={setAssignees} /></Field>
      <Field label="Due date" optional><input type="date" className="input !w-auto" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></Field>
      <Field label="Details" optional><textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the team should know." /></Field>
      {!editing && (
        <Field label="What kind of step?">
          <div className="grid gap-1.5">
            {(Object.keys(STEP_KINDS) as StepKind[]).map((k) => (
              <label key={k} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 ${kind === k ? "border-accent bg-accent-soft" : "border-line"}`}>
                <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={kind === k} onChange={() => setKind(k)} />
                <span><span className="block text-[0.8125rem] font-semibold">{STEP_KINDS[k].label}</span><span className="text-[0.6875rem] text-muted">{STEP_KINDS[k].help}</span></span>
              </label>
            ))}
          </div>
        </Field>
      )}
    </Modal>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: p, mutate, error } = useApi<Project>(`/api/projects/${id}`);
  const [editing, setEditing] = useState(false);
  const [addingStep, setAddingStep] = useState<string | null>(null);
  const [editStep, setEditStep] = useState<ProjectStep | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [showDone, setShowDone] = useState<boolean | null>(null);

  if (error) {
    return <div className="card"><EmptyState title="This project doesn't exist anymore." hint="It may have been deleted." action={<Link className="btn-primary" href="/projects/all">Back to projects</Link>} /></div>;
  }
  if (!p) {
    return <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const { done, total, pct, current } = projectProgress(p.steps);
  const allDone = total > 0 && done === total;
  // Long projects (imported tasks became steps) fold their finished steps away.
  const doneVisible = showDone ?? done <= 8;
  const backHref = p.type?.special ? `/projects/${p.type.slug}` : "/projects/others";
  // IT projects (type switch "Modules"): tasks are grouped into modules.
  const useModules = !!p.type?.modules;
  const moduleNames = useModules ? moduleGroups(p).map((g) => g.name).filter((n) => n !== GENERAL) : undefined;
  const stepCard = (s: ProjectStep, i: number) => (
    <StepCard key={s.id} step={s} index={i} projectId={p._id}
      isCurrent={p.status !== "completed" && current?.id === s.id}
      onPatch={(patch) => patchStep(s.id, patch).then(() => {})} onEdit={() => setEditStep(s)}
      onDelete={() => deleteStep(s.id, s.title)} onRefresh={() => mutate()} />
  );

  /** Returns false if the save failed (so a form can stay open). */
  async function patchStep(stepId: string, patch: StepPatch) {
    try {
      const next = await api<Project>(`/api/projects/${id}/steps/${stepId}`, { method: "PATCH", body: patch });
      await mutate(next, { revalidate: false });
      const wasDone = p?.steps.find((s) => s.id === stepId)?.status === "done";
      const nowDone = next.steps.find((s) => s.id === stepId)?.status === "done";
      if (!wasDone && nowDone) {
        const prog = projectProgress(next.steps);
        toast.success(prog.done === prog.total ? "🎉 All steps done!" : `Step done — next: ${prog.current?.title}`);
      }
      refresh("/api/projects?", "/api/dashboard", "/api/steps");
      return true;
    } catch (e) {
      toastError(e);
      return false;
    }
  }

  async function deleteStep(stepId: string, title: string) {
    if (!(await confirmDialog(`Remove “${title}” from this project?`, { danger: true, confirmLabel: "Remove step", detail: "Only this project changes. Any daily counts on this step are removed too." }))) return;
    try {
      await mutate(await api<Project>(`/api/projects/${id}/steps/${stepId}`, { method: "DELETE" }), { revalidate: false });
    } catch (e) {
      toastError(e);
    }
  }

  async function addStep(step: NewStep) {
    try {
      await mutate(await api<Project>(`/api/projects/${id}/steps`, { body: step }), { revalidate: false });
      toast.success("Step added.");
      refresh("/api/projects?", "/api/dashboard", "/api/steps");
      return true;
    } catch (e) {
      toastError(e);
      return false;
    }
  }

  async function quickAdd() {
    const title = quickTitle.trim();
    if (!title) return;
    if (await addStep({ title, kind: "check", assignees: [], dueDate: null, note: "" })) setQuickTitle("");
  }

  async function setStatus(status: Project["status"]) {
    try {
      await mutate(await api<Project>(`/api/projects/${id}`, { method: "PUT", body: { status } }), { revalidate: false });
      toast.success(status === "completed" ? "🎉 Project closed. Great work!" : status === "on-hold" ? "Project put on hold." : "Project re-opened.");
      refresh("/api/projects?", "/api/dashboard");
    } catch (e) {
      toastError(e);
    }
  }

  async function remove() {
    if (!(await confirmDialog("Delete this project?", { danger: true, confirmLabel: "Delete project", detail: "Its steps and history will be hidden for everyone." }))) return;
    try {
      await api(`/api/projects/${id}`, { method: "DELETE" });
      toast.success("Project deleted.");
      refresh("/api/projects?", "/api/dashboard");
      router.push(backHref);
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <div>
      <Link href={backHref} className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg">
        <ArrowLeft className="h-3.5 w-3.5" />{p.type?.special ? `${p.type.name} projects` : "Other projects"}
      </Link>

      {/* Header */}
      <div className="card mb-3 !p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TypeIcon icon={p.type?.icon} size="lg" />
            <div className="min-w-0">
              <h1 className="flex min-w-0 items-center gap-1 text-lg leading-tight font-extrabold tracking-tight">
                <span className="truncate">{projectTitle(p)}</span>
                <StarButton p={p} size="md" />
              </h1>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="chip bg-accent-soft text-accent">{p.type?.name}</span>
                {p.company?.name && <span className="chip bg-panel2 text-muted"><Building className="h-3 w-3" />{p.company.name}</span>}
                <DeadlineBadge date={p.deadline} done={p.status === "completed"} />
                {p.legacyName && <span className="chip bg-panel2 text-muted" title="Name in the old system">Was: {p.legacyName}</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {total > 0 && <span className="flex items-center gap-1.5"><ProgressRing value={pct} /><span className="text-xs font-semibold text-muted">{done}/{total} steps</span></span>}
            <div className="flex gap-0.5 rounded-lg border border-line bg-panel2/60 p-0.5">
              {STATUS.map(({ key, label, icon: Icon }) => (
                <button key={key} onClick={() => key !== p.status && setStatus(key)}
                  className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold whitespace-nowrap ${p.status === key ? (key === "completed" ? "bg-accent text-[var(--accent-fg)]" : "bg-panel text-accent shadow-sm") : "text-muted hover:text-fg"}`}>
                  <Icon className="h-3.5 w-3.5" />{label}
                </button>
              ))}
            </div>
            <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />Edit</button>
            {(me?.role === "admin" || me?.id === p.createdBy) && (
              <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={remove} aria-label="Delete project"><Trash className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>
        {p.notes && <p className="mt-2 rounded-md bg-panel2 px-2.5 py-1.5 text-xs whitespace-pre-wrap">{p.notes}</p>}
      </div>

      {allDone && p.status !== "completed" && (
        <div className="animate-pop mb-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-accent/40 bg-accent-soft px-3 py-2">
          <PartyPopper className="h-5 w-5 shrink-0 text-accent" />
          <p className="flex-1 text-[0.8125rem]"><b>Every step is done!</b> <span className="text-muted">Close the project so it moves to “Completed”.</span></p>
          <button className="btn-primary btn-sm" onClick={() => setStatus("completed")}><CircleCheck className="h-3.5 w-3.5" />Close project</button>
        </div>
      )}

      <div>
        {/* Steps — these are the project's tasks too */}
        <section>
          <div className="mb-1.5 flex items-center justify-between gap-2">
            <h2 className="text-sm font-extrabold">{useModules ? "Modules & tasks" : "Steps"} <span className="font-semibold text-muted">· {total - done} to do</span></h2>
            <div className="flex items-center gap-3">
              {done > 0 && total > done && (
                <button className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg" onClick={() => setShowDone(!doneVisible)}>
                  {doneVisible ? <><EyeOff className="h-3.5 w-3.5" />Hide {done} done</> : <><Eye className="h-3.5 w-3.5" />Show {done} done</>}
                </button>
              )}
              <button className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent" onClick={() => setAddingStep("")}>
                <ListPlus className="h-3.5 w-3.5" />Add a step
              </button>
            </div>
          </div>
          {useModules ? (
            <ModulesBoard p={p} doneVisible={doneVisible} renderStep={stepCard}
              onAdd={(title, module) => addStep({ title, kind: "check", assignees: [], dueDate: null, note: "", module })}
              onChanged={(next) => { mutate(next, { revalidate: false }); refresh("/api/projects?"); }} />
          ) : total === 0 ? (
            <div className="card">
              <EmptyState title="No steps for this project" hint="This product type has no step template. Add the work one step at a time."
                action={<button className="btn-soft" onClick={() => setAddingStep("")}><ListPlus className="h-4 w-4" />Add a step</button>} />
            </div>
          ) : (
            <div className="card overflow-hidden !p-0">
              <StepsHeader />
              {p.steps.map((s, i) => (!doneVisible && s.status === "done" ? null : stepCard(s, i)))}
              {!doneVisible && total === done && <p className="px-3 py-3 text-center text-xs text-muted">All {done} steps are done.</p>}
            </div>
          )}
          {/* Add work one step at a time: type and press Enter. (IT projects add inside each module.) */}
          {!useModules && <div className="mt-2 flex gap-2">
            <div className="relative flex-1">
              <Plus className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
              <input className="input !pl-9" placeholder="Add a step… (press Enter)" value={quickTitle}
                onChange={(e) => setQuickTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && quickAdd()} />
            </div>
            <button className="btn-ghost" onClick={() => setAddingStep(quickTitle)} title="People, due date, details, other kinds">
              <SlidersHorizontal className="h-4 w-4" /><span className="hidden sm:inline">More options</span>
            </button>
          </div>}
          <FilesPanel projectId={p._id} />
        </section>

        <p className="mt-3 px-1 text-[0.6875rem] text-muted">
          Created by {p.createdByName || "someone"} · {fmtDate(p.createdAt, { day: "numeric", month: "short", year: "numeric" })}
        </p>
      </div>

      {editing && <EditProjectModal p={p} onClose={() => setEditing(false)} onSaved={(next) => mutate(next, { revalidate: false })} />}
      {addingStep !== null && (
        <StepFormModal initial={{ title: addingStep }} modules={moduleNames} onClose={() => setAddingStep(null)}
          onSave={(st) => addStep(st).then((ok) => { if (ok) setQuickTitle(""); return ok; })} />
      )}
      {editStep && (
        <StepFormModal editing initial={{ ...editStep, assignees: stepPeople(editStep) }} modules={moduleNames} onClose={() => setEditStep(null)}
          onSave={({ title, assignees, dueDate, note, module }) => patchStep(editStep.id, { title, assignees, dueDate, note, ...(moduleNames ? { module } : {}) })} />
      )}
    </div>
  );
}
