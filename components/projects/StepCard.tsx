"use client";

import { useState } from "react";
import { CalendarDays, Check, ChevronDown, ExternalLink, Link as LinkIcon, Pencil, RotateCcw, Trash } from "lucide-react";
import { AvatarStack, DeadlineBadge } from "@/components/ui/bits";
import { UserMultiSelect, useUserName } from "@/components/ui/UserPicker";
import LanguagesPanel from "./LanguagesPanel";
import QuantityPanel from "./QuantityPanel";
import PrinterPanel from "./PrinterPanel";
import { fmtDate, useMe } from "@/lib/client";
import { languageProgress, STEP_KINDS, stepPeople, type ProjectStep, type StepData } from "@/lib/workflow";

export type StepPatch = Partial<Pick<ProjectStep, "status" | "assignees" | "dueDate" | "note" | "link" | "title" | "module">> & { data?: Partial<StepData> };

/** Shared column layout so the header and every row line up like a table. */
export const STEP_GRID = "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 lg:grid-cols-[24px_minmax(0,1fr)_110px_130px_92px_88px_128px]";

export function StepsHeader() {
  return (
    <div className={`${STEP_GRID} hidden border-b border-line bg-panel2/60 px-3 py-2 text-[0.6875rem] font-semibold tracking-wide text-muted uppercase lg:grid`}>
      <span>#</span><span>Step</span><span>Kind</span><span>People</span><span>Due</span><span>Status</span><span />
    </div>
  );
}

function StatusPill({ step }: { step: ProjectStep }) {
  if (step.status === "done") return <span className="chip bg-accent text-[var(--accent-fg)]">Done</span>;
  if (step.status === "doing") return <span className="chip bg-accent-soft text-accent">In progress</span>;
  return <span className="chip bg-panel2 text-muted">To do</span>;
}

export default function StepCard({ step, index, isCurrent, projectId, onPatch, onEdit, onDelete, onRefresh }: {
  step: ProjectStep;
  index: number;
  isCurrent: boolean;
  projectId: string;
  onPatch: (patch: StepPatch) => Promise<void>;
  /** Opens the edit form (name, people, due date, details). */
  onEdit: () => void;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const nameOf = useUserName();
  const { data: me } = useMe();
  const done = step.status === "done";
  const people = stepPeople(step);
  const names = people.map(nameOf).filter(Boolean);
  const [open, setOpen] = useState(isCurrent);
  const [link, setLink] = useState(step.link);
  const [busy, setBusy] = useState(false);

  // Follow the "current step" as the project moves forward.
  const [wasCurrent, setWasCurrent] = useState(isCurrent);
  if (wasCurrent !== isCurrent) {
    setWasCurrent(isCurrent);
    setOpen(isCurrent);
  }

  async function setStatus(status: ProjectStep["status"]) {
    setBusy(true);
    try {
      // "I'm working on it" also puts you on the step.
      const joinMe = status === "doing" && me && !people.includes(me.id) ? { assignees: [...people, me.id] } : {};
      await onPatch({ status, ...joinMe, ...(step.kind === "link" && link !== step.link ? { link } : {}) });
    } finally {
      setBusy(false);
    }
  }

  const langs = step.kind === "languages" ? languageProgress(step.data) : null;
  const summary = done
    ? `Done${step.doneByName ? ` by ${step.doneByName}` : ""}${step.doneAt ? ` · ${fmtDate(step.doneAt)}` : ""}`
    : langs ? `${langs.done}/${langs.total} language parts done`
    : step.kind === "quantity" && step.data.totals ? `${step.data.totals.completed} ${step.data.unit || "pcs"} completed so far`
    : step.kind === "printer" && step.data.printerName ? `Printer: ${step.data.printerName}`
    : "";

  return (
    <div className={`border-b border-line/70 last:border-0 ${isCurrent ? "bg-accent-soft/40" : ""}`}>
      <div className={`${STEP_GRID} cursor-pointer px-3 py-2 hover:bg-panel2/50`} onClick={() => setOpen(!open)}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[0.6875rem] font-bold ${
          done ? "bg-accent text-[var(--accent-fg)]" : isCurrent ? "border-2 border-accent text-accent" : "border border-line text-muted"
        }`}>
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-[0.8125rem] font-semibold ${done ? "text-muted" : ""}`}>{step.title}</span>
            {isCurrent && <span className="chip shrink-0 bg-accent text-[var(--accent-fg)]">Next up</span>}
          </div>
          {(summary || step.kind !== "check" || names.length > 0 || step.dueDate || step.note) && (
            <p className="truncate text-[0.6875rem] text-muted">
              <span className="lg:hidden">
                {[step.kind !== "check" && STEP_KINDS[step.kind].label, names.join(", "), step.dueDate && !done && `due ${fmtDate(step.dueDate)}`].filter(Boolean).join(" · ")}
                {summary && (step.kind !== "check" || names.length > 0 || step.dueDate) ? " · " : ""}
              </span>
              {summary || (!done && step.note) || ""}
            </p>
          )}
        </div>

        <span className="hidden truncate text-xs text-muted lg:block">{STEP_KINDS[step.kind].label}</span>
        <span className="hidden min-w-0 items-center gap-1.5 text-xs lg:flex" title={names.join(", ")}>
          {names.length ? <><AvatarStack names={names} size="xs" />{names.length === 1 && <span className="truncate">{names[0]}</span>}</> : <span className="text-muted">—</span>}
        </span>
        <span className="hidden lg:block">{step.dueDate ? <DeadlineBadge date={step.dueDate} done={done} /> : <span className="text-xs text-muted">—</span>}</span>
        <span className="hidden lg:block"><StatusPill step={step} /></span>

        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
          {done ? (
            <button className="icon-btn !h-7 !w-7" title="Not done yet" aria-label="Mark as not done" onClick={() => setStatus("todo")} disabled={busy}>
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          ) : (
            <button className={isCurrent ? "btn-primary btn-sm" : "btn-ghost btn-sm"} onClick={() => setStatus("done")} disabled={busy}>
              <Check className="h-3.5 w-3.5" strokeWidth={3} />Done
            </button>
          )}
          <button className="icon-btn !h-7 !w-7" aria-label={`Edit “${step.title}”`} title="Edit step" onClick={onEdit}>
            <Pencil className="h-3.5 w-3.5" />
          </button>
          <button className="icon-btn !h-7 !w-7" aria-label={open ? "Hide details" : "Show details"} onClick={() => setOpen(!open)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade px-3 pb-3 lg:pl-12">
          {step.hint && <p className="mb-2 rounded-md bg-panel2 px-2.5 py-1.5 text-xs text-muted">💡 {step.hint}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-14 text-xs font-semibold text-muted">People</span>
            <div className="min-w-56 flex-1 sm:max-w-80"><UserMultiSelect value={people} onChange={(ids) => onPatch({ assignees: ids })} placeholder="Who's doing it?" /></div>
            <label className="flex items-center gap-1.5 text-xs font-semibold text-muted">
              <CalendarDays className="h-3.5 w-3.5" />Due
              <input type="date" className="input !w-auto !py-1 text-xs" value={step.dueDate || ""} onChange={(e) => onPatch({ dueDate: e.target.value || null })} />
            </label>
            {/* "I'm working" toggle: on = in progress (and you're on it), off = back to no status. */}
            {!done && step.kind !== "languages" && (
              <button className={`${step.status === "doing" ? "btn-primary" : "btn-ghost"} btn-sm`} disabled={busy} aria-pressed={step.status === "doing"}
                onClick={() => setStatus(step.status === "doing" ? "todo" : "doing")}
                title={step.status === "doing" ? "Click to clear the mark" : "Mark this step as in progress"}>
                {step.status === "doing" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{step.status === "doing" ? "Uncheck Working on it" : "I&apos;m working on it"}
              </button>
            )}
          </div>

          {step.kind === "link" && (
            <div className="mt-2 flex gap-1.5">
              <div className="relative flex-1">
                <LinkIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
                <input className="input !pl-8" placeholder="Paste the link here" value={link} onChange={(e) => setLink(e.target.value)}
                  onBlur={() => link !== step.link && onPatch({ link })} />
              </div>
              {step.link && <a href={step.link} target="_blank" rel="noreferrer" className="btn-ghost !px-2" aria-label="Open link"><ExternalLink className="h-3.5 w-3.5" /></a>}
            </div>
          )}
          {step.kind === "languages" && <LanguagesPanel step={step} onSave={(data) => onPatch({ data })} />}
          {step.kind === "quantity" && <QuantityPanel projectId={projectId} step={step} onSaveSettings={(data) => onPatch({ data })} onChanged={onRefresh} />}
          {step.kind === "printer" && <PrinterPanel step={step} onSave={(data) => onPatch({ data })} />}

          <label className="mt-3 block">
            <span className="mb-1 block text-xs font-semibold text-muted">Details / latest update</span>
            <textarea className="input" rows={2} placeholder="What's the status? Shown when someone hovers the project in the list." defaultValue={step.note}
              onBlur={(e) => e.target.value !== step.note && onPatch({ note: e.target.value })} />
          </label>

          <div className="mt-2 flex flex-wrap items-center gap-2 text-[0.6875rem] text-muted">
            <input className="input max-w-72 !py-1 text-xs" defaultValue={step.title} aria-label="Step name"
              onBlur={(e) => e.target.value.trim() && e.target.value.trim() !== step.title && onPatch({ title: e.target.value.trim() })} />
            {step.createdByName && <span>Added by {step.createdByName}{step.createdAt ? ` · ${fmtDate(step.createdAt)}` : ""}</span>}
            <button className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger" onClick={onDelete}>
              <Trash className="h-3.5 w-3.5" />Remove step
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
