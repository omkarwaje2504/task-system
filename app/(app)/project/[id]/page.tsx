"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Building, CircleCheck, CirclePause, CirclePlay, ListPlus, Pencil, PartyPopper, Trash, type LucideIcon,
} from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import Modal from "@/components/ui/Modal";
import { DeadlineBadge, EmptyState, Field, ProgressRing, Skeleton } from "@/components/ui/bits";
import StepCard, { StepsHeader, type StepPatch } from "@/components/projects/StepCard";
import BrandCompanyFields from "@/components/projects/BrandCompanyFields";
import { projectTitle } from "@/components/projects/ProjectCard";
import TaskRow from "@/components/tasks/TaskRow";
import { QuickAddTask, TaskEditModal } from "@/components/tasks/TaskForm";
import { api, fmtDate, refresh, useApi, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { projectProgress, STEP_KINDS, type StepKind } from "@/lib/workflow";
import type { Project, Task } from "@/lib/types";

const STATUS: { key: Project["status"]; label: string; icon: LucideIcon }[] = [
  { key: "active", label: "In progress", icon: CirclePlay },
  { key: "on-hold", label: "On hold", icon: CirclePause },
  { key: "completed", label: "Completed", icon: CircleCheck },
];

function EditProjectModal({ p, onClose, onSaved }: { p: Project; onClose: () => void; onSaved: (p: Project) => void }) {
  const [theme, setTheme] = useState(p.theme);
  const [company, setCompany] = useState(p.company?.name || "");
  const [brand, setBrand] = useState(p.brand?.name || "");
  const [deadline, setDeadline] = useState(p.deadline || "");
  const [notes, setNotes] = useState(p.notes || "");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      const next = await api<Project>(`/api/projects/${p._id}`, { method: "PUT", body: { theme, companyName: company, brandName: brand, deadline: deadline || null, notes } });
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
      <Field label="Theme" optional><input className="input" value={theme} onChange={(e) => setTheme(e.target.value)} /></Field>
      <BrandCompanyFields company={company} brand={brand} onCompany={setCompany} onBrand={setBrand} />
      <Field label="Deadline" optional><input type="date" className="input !w-auto" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      <Field label="Notes" optional><textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} /></Field>
    </Modal>
  );
}

function AddStepModal({ onClose, onAdd }: { onClose: () => void; onAdd: (title: string, kind: StepKind) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<StepKind>("check");
  return (
    <Modal open onClose={onClose} title="Add a step" subtitle="Only for this project — the product type's template stays the same."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!title.trim()} onClick={() => onAdd(title, kind).then(onClose)}>Add step</button></>}>
      <Field label="Step name"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus placeholder="e.g. Extra revision round" /></Field>
      <Field label="What kind of step?">
        <div className="grid gap-1.5">
          {(Object.keys(STEP_KINDS) as StepKind[]).map((k) => (
            <label key={k} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-2.5 py-2 ${kind === k ? "border-accent bg-accent-soft" : "border-line"}`}>
              <input type="radio" className="mt-0.5 accent-[var(--accent)]" checked={kind === k} onChange={() => setKind(k)} />
              <span><span className="block text-[13px] font-semibold">{STEP_KINDS[k].label}</span><span className="text-[11px] text-muted">{STEP_KINDS[k].help}</span></span>
            </label>
          ))}
        </div>
      </Field>
    </Modal>
  );
}

export default function ProjectPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { data: me } = useMe();
  const { data: p, mutate, error } = useApi<Project>(`/api/projects/${id}`);
  const { data: tasks = [], mutate: mutateTasks } = useApi<Task[]>(`/api/tasks?project=${id}&status=all`);
  const [editing, setEditing] = useState(false);
  const [addingStep, setAddingStep] = useState(false);
  const [editTask, setEditTask] = useState<Task | null>(null);

  if (error) {
    return <div className="card"><EmptyState title="This project doesn't exist anymore." hint="It may have been deleted." action={<Link className="btn-primary" href="/projects/all">Back to projects</Link>} /></div>;
  }
  if (!p) {
    return <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  }

  const { done, total, pct, current } = projectProgress(p.steps);
  const allDone = total > 0 && done === total;
  const openTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");
  const backHref = p.type?.special ? `/projects/${p.type.slug}` : "/projects/others";

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
      refresh("/api/projects?", "/api/dashboard");
    } catch (e) {
      toastError(e);
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

  async function addStep(title: string, kind: StepKind) {
    try {
      await mutate(await api<Project>(`/api/projects/${id}/steps`, { body: { title, kind } }), { revalidate: false });
      toast.success("Step added.");
    } catch (e) {
      toastError(e);
    }
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
              <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight">{projectTitle(p)}</h1>
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
          <p className="flex-1 text-[13px]"><b>Every step is done!</b> <span className="text-muted">Close the project so it moves to “Completed”.</span></p>
          <button className="btn-primary btn-sm" onClick={() => setStatus("completed")}><CircleCheck className="h-3.5 w-3.5" />Close project</button>
        </div>
      )}

      <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
        {/* Steps */}
        <section>
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">Steps</h2>
            <button className="flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent" onClick={() => setAddingStep(true)}>
              <ListPlus className="h-3.5 w-3.5" />Add a step
            </button>
          </div>
          {total === 0 ? (
            <div className="card">
              <EmptyState title="No steps for this project" hint="This product type has no step template. Track the work with tasks, or add steps yourself."
                action={<button className="btn-soft" onClick={() => setAddingStep(true)}><ListPlus className="h-4 w-4" />Add a step</button>} />
            </div>
          ) : (
            <div className="card overflow-hidden !p-0">
              <StepsHeader />
              {p.steps.map((s, i) => (
                <StepCard key={s.id} step={s} index={i} projectId={p._id}
                  isCurrent={p.status !== "completed" && current?.id === s.id}
                  onPatch={(patch) => patchStep(s.id, patch)} onDelete={() => deleteStep(s.id, s.title)} onRefresh={() => mutate()} />
              ))}
            </div>
          )}
        </section>

        {/* Tasks */}
        <aside>
          <div className="mb-1.5 flex items-center justify-between">
            <h2 className="text-sm font-extrabold">Tasks</h2>
            <span className="text-xs font-semibold text-muted">{openTasks.length} open</span>
          </div>
          <QuickAddTask projectId={p._id} onAdded={() => { mutateTasks(); refresh("/api/dashboard"); }} />
          <div className="card mt-2 !p-1">
            {openTasks.length === 0 && doneTasks.length === 0 && <p className="px-3 py-4 text-center text-xs text-muted">No tasks yet. Add small to-dos above.</p>}
            {openTasks.map((t) => <TaskRow key={t._id} task={t} showProject={false} onChange={() => mutateTasks()} onEdit={setEditTask} />)}
            {doneTasks.length > 0 && (
              <details className="mt-1">
                <summary className="cursor-pointer px-2 py-1.5 text-xs font-bold text-muted">{doneTasks.length} done</summary>
                {doneTasks.map((t) => <TaskRow key={t._id} task={t} showProject={false} onChange={() => mutateTasks()} onEdit={setEditTask} />)}
              </details>
            )}
          </div>
          <p className="mt-2 px-1 text-[11px] text-muted">
            Created by {p.createdByName || "someone"} · {fmtDate(p.createdAt, { day: "numeric", month: "short", year: "numeric" })}
          </p>
        </aside>
      </div>

      {editing && <EditProjectModal p={p} onClose={() => setEditing(false)} onSaved={(next) => mutate(next, { revalidate: false })} />}
      {addingStep && <AddStepModal onClose={() => setAddingStep(false)} onAdd={addStep} />}
      {editTask && <TaskEditModal task={editTask} onClose={() => setEditTask(null)} onSaved={() => mutateTasks()} />}
    </div>
  );
}
