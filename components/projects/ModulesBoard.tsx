"use client";

import { useState, type ReactNode } from "react";
import { Blocks, ChevronDown, Plus, Trash } from "lucide-react";
import { ProgressBar } from "@/components/ui/bits";
import { api } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { ProjectStep } from "@/lib/workflow";
import type { Project } from "@/lib/types";
import { StepsHeader } from "./StepCard";

export const GENERAL = "General";

/** Module names in display order: General (unsorted / template steps) first, then the project's modules. */
export function moduleGroups(p: Pick<Project, "steps" | "modules">) {
  const names = [...(p.modules || [])];
  for (const s of p.steps) if (s.module && !names.includes(s.module)) names.push(s.module);
  const hasGeneral = p.steps.some((s) => !s.module) || names.length === 0;
  return [...(hasGeneral ? [GENERAL] : []), ...names].map((name) => ({
    name,
    steps: p.steps.map((s, index) => ({ s, index })).filter(({ s }) => (name === GENERAL ? !s.module : s.module === name)),
  }));
}

function ModuleTitle({ name, onRename }: { name: string; onRename?: (to: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  if (!onRename) return <span className="truncate text-[0.8125rem] font-extrabold">{name}</span>;
  if (editing) {
    const commit = () => {
      setEditing(false);
      if (value.trim() && value.trim() !== name) onRename(value.trim());
    };
    return (
      <input autoFocus className="input max-w-64 !py-0.5 text-[0.8125rem] font-bold" value={value} onChange={(e) => setValue(e.target.value)}
        onBlur={commit} onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} onClick={(e) => e.stopPropagation()} />
    );
  }
  return (
    <button className="truncate text-left text-[0.8125rem] font-extrabold hover:text-accent" title="Rename module"
      onClick={(e) => { e.stopPropagation(); setValue(name); setEditing(true); }}>{name}</button>
  );
}

/**
 * IT projects: tasks grouped into modules (pages / parts / sections). Each
 * module is a card with its own progress and its own "add a task" box.
 */
export default function ModulesBoard({ p, doneVisible, renderStep, onAdd, onChanged }: {
  p: Project;
  doneVisible: boolean;
  renderStep: (s: ProjectStep, index: number) => ReactNode;
  onAdd: (title: string, module: string) => Promise<boolean>;
  onChanged: (next: Project) => void;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [newModule, setNewModule] = useState("");
  const groups = moduleGroups(p);
  const url = `/api/projects/${p._id}/modules`;

  async function run(req: Promise<Project>, ok?: string) {
    try {
      onChanged(await req);
      if (ok) toast.success(ok);
      return true;
    } catch (e) {
      toastError(e);
      return false;
    }
  }

  async function addModule() {
    const name = newModule.trim();
    if (name && (await run(api<Project>(url, { body: { name } }), `Module “${name}” added.`))) setNewModule("");
  }

  async function removeModule(name: string, count: number) {
    if (count && !(await confirmDialog(`Remove the module “${name}”?`, { confirmLabel: "Remove module", detail: `Its ${count} task${count === 1 ? "" : "s"} stay in the project, under “${GENERAL}”.` }))) return;
    run(api<Project>(`${url}?name=${encodeURIComponent(name)}`, { method: "DELETE" }));
  }

  async function addTask(module: string) {
    const title = (drafts[module] || "").trim();
    if (title && (await onAdd(title, module === GENERAL ? "" : module))) setDrafts((d) => ({ ...d, [module]: "" }));
  }

  return (
    <div className="space-y-2.5">
      {groups.map(({ name, steps }) => {
        const done = steps.filter(({ s }) => s.status === "done").length;
        const shown = steps.filter(({ s }) => doneVisible || s.status !== "done");
        const isClosed = collapsed[name];
        return (
          <section key={name} className="card overflow-hidden !p-0">
            <div className="flex cursor-pointer items-center gap-2 border-b border-line px-3 py-2" onClick={() => setCollapsed((c) => ({ ...c, [name]: !isClosed }))}>
              <Blocks className="h-4 w-4 shrink-0 text-accent" />
              <div className="min-w-0 flex-1"><ModuleTitle name={name} onRename={name === GENERAL ? undefined : (to) => run(api<Project>(url, { method: "PATCH", body: { from: name, to } }))} /></div>
              <span className="hidden items-center gap-2 sm:flex">
                <ProgressBar value={steps.length ? (done / steps.length) * 100 : 0} className="w-20" />
              </span>
              <span className="shrink-0 text-xs font-semibold text-muted tabular-nums">{done}/{steps.length}</span>
              {name !== GENERAL && (
                <button className="icon-btn !h-7 !w-7 hover:!text-danger" aria-label={`Remove module ${name}`} title="Remove module"
                  onClick={(e) => { e.stopPropagation(); removeModule(name, steps.length); }}>
                  <Trash className="h-3.5 w-3.5" />
                </button>
              )}
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition-transform ${isClosed ? "-rotate-90" : ""}`} />
            </div>
            {!isClosed && (
              <>
                {shown.length > 0 && <StepsHeader />}
                {shown.map(({ s, index }) => renderStep(s, index))}
                {steps.length > 0 && shown.length === 0 && <p className="px-3 py-2 text-xs text-muted">All {steps.length} done.</p>}
                <div className="relative border-t border-line/70">
                  <Plus className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input className="w-full bg-transparent py-2 pr-3 pl-9 text-[0.8125rem] outline-none placeholder:text-muted" placeholder={`Add a task to ${name}… (press Enter)`}
                    value={drafts[name] || ""} onChange={(e) => setDrafts((d) => ({ ...d, [name]: e.target.value }))} onKeyDown={(e) => e.key === "Enter" && addTask(name)} />
                </div>
              </>
            )}
          </section>
        );
      })}

      <div className="flex gap-2">
        <div className="relative flex-1">
          <Blocks className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted" />
          <input className="input !pl-9" placeholder="New module — e.g. Login page, Dashboard, Admin panel" value={newModule}
            onChange={(e) => setNewModule(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addModule()} />
        </div>
        <button className="btn-ghost" onClick={addModule} disabled={!newModule.trim()}><Plus className="h-4 w-4" />Add module</button>
      </div>
    </div>
  );
}
