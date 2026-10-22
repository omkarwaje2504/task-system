"use client";

import { useState } from "react";
import { Check, ChevronDown, ExternalLink, Link as LinkIcon, MessageSquareText, RotateCcw, Trash } from "lucide-react";
import { Avatar } from "@/components/ui/bits";
import { UserSelect, useUserName } from "@/components/ui/UserPicker";
import LanguagesPanel from "./LanguagesPanel";
import QuantityPanel from "./QuantityPanel";
import PrinterPanel from "./PrinterPanel";
import { fmtDate } from "@/lib/client";
import { languageProgress, STEP_KINDS, type ProjectStep, type StepData } from "@/lib/workflow";

export type StepPatch = Partial<Pick<ProjectStep, "status" | "assignee" | "note" | "link" | "title">> & { data?: Partial<StepData> };

/** Shared column layout so the header and every row line up like a table. */
export const STEP_GRID = "grid grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-x-3 lg:grid-cols-[24px_minmax(0,1fr)_130px_160px_96px_88px]";

export function StepsHeader() {
  return (
    <div className={`${STEP_GRID} hidden border-b border-line bg-panel2/60 px-3 py-2 text-[11px] font-semibold tracking-wide text-muted uppercase lg:grid`}>
      <span>#</span><span>Step</span><span>Kind</span><span>Assigned</span><span>Status</span><span />
    </div>
  );
}

function StatusPill({ step }: { step: ProjectStep }) {
  if (step.status === "done") return <span className="chip bg-accent text-[var(--accent-fg)]">Done</span>;
  if (step.status === "doing") return <span className="chip bg-accent-soft text-accent">In progress</span>;
  return <span className="chip bg-panel2 text-muted">To do</span>;
}

export default function StepCard({ step, index, isCurrent, projectId, onPatch, onDelete, onRefresh }: {
  step: ProjectStep;
  index: number;
  isCurrent: boolean;
  projectId: string;
  onPatch: (patch: StepPatch) => Promise<void>;
  onDelete: () => void;
  onRefresh: () => void;
}) {
  const nameOf = useUserName();
  const done = step.status === "done";
  const [open, setOpen] = useState(isCurrent);
  const [link, setLink] = useState(step.link);
  const [noteOpen, setNoteOpen] = useState(!!step.note);
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
      await onPatch({ status, ...(step.kind === "link" && link !== step.link ? { link } : {}) });
    } finally {
      setBusy(false);
    }
  }

  const langs = step.kind === "languages" ? languageProgress(step.data) : null;
  const assignee = nameOf(step.assignee);
  const summary = done
    ? `Done${step.doneByName ? ` by ${step.doneByName}` : ""}${step.doneAt ? ` · ${fmtDate(step.doneAt)}` : ""}`
    : langs ? `${langs.done}/${langs.total} language parts done`
    : step.kind === "quantity" && step.data.totals ? `${step.data.totals.completed} ${step.data.unit || "pcs"} completed so far`
    : step.kind === "printer" && step.data.printerName ? `Printer: ${step.data.printerName}`
    : "";

  return (
    <div className={`border-b border-line/70 last:border-0 ${isCurrent ? "bg-accent-soft/40" : ""}`}>
      <div className={`${STEP_GRID} cursor-pointer px-3 py-2 hover:bg-panel2/50`} onClick={() => setOpen(!open)}>
        <span className={`flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold ${
          done ? "bg-accent text-[var(--accent-fg)]" : isCurrent ? "border-2 border-accent text-accent" : "border border-line text-muted"
        }`}>
          {done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : index + 1}
        </span>

        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            <span className={`truncate text-[13px] font-semibold ${done ? "text-muted" : ""}`}>{step.title}</span>
            {isCurrent && <span className="chip shrink-0 bg-accent text-[var(--accent-fg)]">Next up</span>}
          </div>
          {(summary || step.kind !== "check" || assignee) && (
            <p className="truncate text-[11px] text-muted">
              <span className="lg:hidden">{[step.kind !== "check" && STEP_KINDS[step.kind].label, assignee].filter(Boolean).join(" · ")}{summary && (step.kind !== "check" || assignee) ? " · " : ""}</span>
              {summary}
            </p>
          )}
        </div>

        <span className="hidden truncate text-xs text-muted lg:block">{STEP_KINDS[step.kind].label}</span>
        <span className="hidden min-w-0 items-center gap-1.5 text-xs lg:flex">
          {assignee ? <><Avatar name={assignee} size="xs" /><span className="truncate">{assignee}</span></> : <span className="text-muted">—</span>}
        </span>
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
          <button className="icon-btn !h-7 !w-7" aria-label={open ? "Hide details" : "Show details"} onClick={() => setOpen(!open)}>
            <ChevronDown className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {open && (
        <div className="animate-fade px-3 pb-3 lg:pl-12">
          {step.hint && <p className="mb-2 rounded-md bg-panel2 px-2.5 py-1.5 text-xs text-muted">💡 {step.hint}</p>}

          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">Assigned to</span>
            <div className="w-56"><UserSelect compact value={step.assignee} onChange={(id) => onPatch({ assignee: id })} /></div>
            {!done && step.status !== "doing" && step.kind !== "languages" && (
              <button className="btn-ghost btn-sm" onClick={() => setStatus("doing")} disabled={busy}>I&apos;m working on it</button>
            )}
            <button className="ml-auto flex items-center gap-1 text-xs font-semibold text-muted hover:text-danger" onClick={onDelete}>
              <Trash className="h-3.5 w-3.5" />Remove step
            </button>
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

          {noteOpen ? (
            <textarea className="input mt-2" rows={2} placeholder="Add a note for the team…" defaultValue={step.note}
              onBlur={(e) => e.target.value !== step.note && onPatch({ note: e.target.value })} />
          ) : (
            <button className="mt-2 flex items-center gap-1 text-xs font-semibold text-muted hover:text-accent" onClick={() => setNoteOpen(true)}>
              <MessageSquareText className="h-3.5 w-3.5" />Add a note
            </button>
          )}
        </div>
      )}
    </div>
  );
}
