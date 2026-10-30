"use client";

import { useState, type HTMLAttributes, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronRight, Hand, Star, X } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar, DeadlineBadge, ProgressBar, SortTh, useSort } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import { api, movedOffText, refresh, useMe } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import { checklistStatus, countSummary, projectProgress, stepPeople, stepWorkers, workingStep, type CountSummary, type ProjectStep } from "@/lib/workflow";
import type { Project } from "@/lib/types";

export function projectTitle(p: Pick<Project, "brand" | "theme" | "legacyName" | "type">) {
  return [p.brand?.name, p.theme].filter(Boolean).join(" — ") || p.legacyName || `${p.type?.name || ""} project`;
}

const STATUS_LABEL: Record<Project["status"], string> = { active: "In progress", "on-hold": "On hold", completed: "Completed" };

export function StatusChip({ status }: { status: Project["status"] }) {
  const cls = status === "completed" ? "bg-accent text-[var(--accent-fg)]" : status === "on-hold" ? "bg-panel2 text-muted" : "bg-accent-soft text-accent";
  return <span className={`chip ${cls}`}>{STATUS_LABEL[status]}</span>;
}

const fmt = (n: number) => n.toLocaleString("en-IN");

/** Headline count: daily totals (RxPad & co.) or finished videos. */
export function CountCell({ c }: { c: CountSummary | null }) {
  if (!c) return <span className="text-muted">—</span>;
  if (c.kind === "videos") {
    return (
      <div className="flex flex-col leading-tight" title={`${c.done} of ${c.total} videos finished (text + audio)`}>
        <span className="font-semibold tabular-nums">{c.done}<span className="font-normal text-muted">/{c.total}</span> <span className="text-xs font-normal text-muted">videos</span></span>
        <PendingLine pending={c.pending} />
      </div>
    );
  }
  const of = c.target || c.added;
  return (
    <div className="flex flex-col leading-tight" title={`Added ${fmt(c.added)} · Completed ${fmt(c.completed)} · Pending ${fmt(c.pending)} · Declined ${fmt(c.declined)}${c.target ? ` · Target ${fmt(c.target)}` : ""}`}>
      <span className="font-semibold tabular-nums">
        {fmt(c.completed)}{of > 0 && <span className="font-normal text-muted"> / {fmt(of)}</span>}
        <span className="ml-1 text-xs font-normal text-muted">{c.unit}</span>
      </span>
      <PendingLine pending={c.pending} declined={c.declined} />
    </div>
  );
}

function PendingLine({ pending, declined = 0 }: { pending: number; declined?: number }) {
  return (
    <span className="text-[0.6875rem] text-muted tabular-nums">
      {pending > 0 ? <span className="font-semibold text-accent">{fmt(pending)} pending</span> : "Nothing pending"}
      {declined > 0 && <> · <span className="text-danger">{fmt(declined)} declined</span></>}
    </span>
  );
}

/** One-line version for phones. */
export function countText(c: CountSummary | null) {
  if (!c) return "";
  const pending = c.pending ? ` · ${fmt(c.pending)} pending` : "";
  if (c.kind === "videos") return `${c.done}/${c.total} videos${pending}`;
  return `${fmt(c.completed)}/${fmt(c.target || c.added)} ${c.unit}${pending}${c.declined ? ` · ${fmt(c.declined)} declined` : ""}`;
}

/** The step the project is on (see workingStep), marked "In progress" or "Up next". */
export function CurrentStep({ steps, status, nameOf }: { steps: ProjectStep[]; status: string; nameOf: (id: string) => string }) {
  const current = workingStep(steps);
  if (!steps.length) return <span className="text-muted">—</span>;
  if (!current || status === "completed") {
    return <span className="flex items-center gap-1.5 text-muted"><span className="h-1.5 w-1.5 shrink-0 rounded-full bg-fg/40" />All steps done</span>;
  }
  const doing = current.status === "doing";
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      {stepPeople(current)[0] && <Avatar name={nameOf(stepPeople(current)[0])} size="xs" />}
      <span className="min-w-0">
        <span className="block truncate font-medium">{current.title}</span>
        <span className={`flex items-center gap-1 text-[0.6875rem] ${doing ? "text-accent" : "text-muted"}`}>
          <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${doing ? "bg-accent" : "bg-fg/30"}`} />
          {doing ? "In progress" : "Up next"}
        </span>
      </span>
    </span>
  );
}

/** Checklist column: the last item ticked and the next one to do. */
export function ChecklistCell({ p }: { p: Project }) {
  const { done, total, last, next } = checklistStatus(p.type?.checklistOn ? p.checklist : []);
  if (!total) return <span className="text-muted">—</span>;
  return (
    <span className="flex min-w-0 flex-col leading-tight" title={`${done} of ${total} checklist items done`}>
      <span className="flex min-w-0 items-center gap-1 text-[0.6875rem] text-muted">
        <span className="shrink-0 font-semibold tabular-nums">{done}/{total}</span>
        {last && <><Check className="h-3 w-3 shrink-0 text-accent" /><span className="truncate">{last.title}</span></>}
      </span>
      {next
        ? <span className="truncate font-medium"><span className="text-[0.6875rem] font-normal text-muted">Next: </span>{next.title}</span>
        : <span className="text-[0.6875rem] font-semibold text-accent">All ticked</span>}
    </span>
  );
}

export function checklistText(p: Project) {
  const { done, total, next } = checklistStatus(p.type?.checklistOn ? p.checklist : []);
  if (!total) return "";
  return `☑ ${done}/${total}${next ? ` · Next: ${next.title}` : " · all ticked"}`;
}

/**
 * "I'm working" toggle for the project's working step (its latest open step —
 * see workingStep). Click: the step goes in progress and you're put on it.
 * Click again: the mark is cleared (back to no status) — click once more to re-mark.
 */
export function DoingButton({ p }: { p: Project }) {
  const { data: me } = useMe();
  const [busy, setBusy] = useState(false);
  const step = workingStep(p.steps);
  if (!step || p.status === "completed" || !me) return null;
  const onIt = stepWorkers(step).includes(me.id);

  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!step || !me) return;
    setBusy(true);
    try {
      const res = await api<{ stopped?: string[] }>(`/api/projects/${p._id}/steps/${step.id}`, {
        method: "PATCH",
        body: { working: !onIt },
      });
      toast.success(onIt ? `Cleared “I'm working” on “${step.title}”.` : `You're working on “${step.title}”.${movedOffText(res.stopped)}`);
      refresh("/api/projects", "/api/dashboard", "/api/steps", "/api/samples");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className={`${onIt ? "btn-primary" : "btn-soft"} btn-sm shrink-0`} onClick={toggle} disabled={busy} aria-pressed={onIt}
      title={onIt ? `You're working on “${step.title}” — click to clear` : `Mark “${step.title}” as in progress and put you on it`}>
      {onIt ? <><X className="h-3.5 w-3.5" />Uncheck</> : <><Hand className="h-3.5 w-3.5" />I&apos;m working</>}
    </button>
  );
}

/** ★ Priority: starred projects stay at the top of project lists (shared for the whole team). */
export function StarButton({ p, size = "sm" }: { p: Project; size?: "sm" | "md" }) {
  const [busy, setBusy] = useState(false);
  const on = !!p.priority;
  async function toggle(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/projects/${p._id}`, { method: "PUT", body: { priority: !on } });
      toast.success(on ? "Removed from priority." : "Marked as priority — it stays at the top.");
      refresh("/api/projects", "/api/dashboard");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button onClick={toggle} disabled={busy} aria-pressed={on} aria-label={on ? "Remove priority" : "Mark as priority"} title={on ? "Priority — click to remove" : "Mark as priority (stays at the top)"}
      className={`icon-btn ${size === "sm" ? "!h-7 !w-7" : "!h-8 !w-8"} ${on ? "!text-[#ffd60a]" : "opacity-60 hover:opacity-100"}`}>
      <Star className={size === "sm" ? "h-4 w-4" : "h-[18px] w-[18px]"} fill={on ? "currentColor" : "none"} />
    </button>
  );
}

/** Starred projects first; everything else keeps its order. */
export const priorityFirst = <T extends { priority?: boolean }>(list: T[]) => [...list.filter((x) => x.priority), ...list.filter((x) => !x.priority)];

const SORT_LABELS: Record<string, string> = {
  name: "Project", type: "Type", company: "Company", progress: "Progress", step: "Current step", checklist: "Checklist", count: "Count", deadline: "Deadline", todo: "To do",
};

/** Desktop: sortable table, whole row clickable. */
export function ProjectsTable({ projects, showType = true, rowProps }: {
  projects: Project[];
  showType?: boolean;
  /** Extra handlers per row (the projects view uses them for the hover card). */
  rowProps?: (p: Project) => HTMLAttributes<HTMLTableRowElement>;
}) {
  const router = useRouter();
  const nameOf = useUserName();
  const { sorted: bySort, sort, toggle, clear } = useSort(projects, {
    name: (p) => projectTitle(p),
    type: (p) => p.type?.name,
    company: (p) => p.company?.name,
    progress: (p) => projectProgress(p.steps).pct,
    step: (p) => workingStep(p.steps)?.title,
    checklist: (p) => {
      const c = checklistStatus(p.type?.checklistOn ? p.checklist : []);
      return c.total ? c.done / c.total : -1;
    },
    count: (p) => {
      const c = countSummary(p.steps);
      return c ? (c.kind === "quantity" ? c.completed : c.done) : -1;
    },
    deadline: (p) => p.deadline,
    todo: (p) => p.steps.filter((s) => s.status !== "done").length,
  }, "projects");
  const sorted = priorityFirst(bySort);
  const showCount = projects.some((p) => countSummary(p.steps));
  const showChecklist = projects.some((p) => p.type?.checklistOn && p.checklist?.length);

  return (
    <>
    <div className="mb-1.5 flex flex-wrap items-center gap-1.5 px-1 text-[0.6875rem] text-muted">
      {sort.length ? (
        <>
          <span className="font-semibold">Sorted by</span>
          {sort.map((l, i) => (
            <span key={l.key} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3" />}
              <button className="chip bg-accent-soft text-accent" onClick={() => toggle(l.key)} title="Flip / remove">
                {SORT_LABELS[l.key] || l.key} {l.dir === "asc" ? "↑" : "↓"}
              </button>
            </span>
          ))}
          <button className="flex items-center gap-0.5 font-semibold hover:text-fg" onClick={clear}><X className="h-3 w-3" />Clear</button>
        </>
      ) : <span>Click column headers to sort — each one you click is added as the next level (e.g. Type, then Company). ★ Priority projects stay on top.</span>}
    </div>
    <div className="card overflow-x-auto !p-0">
      <table className="tbl">
        <thead>
          <tr>
            <th className="w-0 !pr-0" aria-label="Priority" />
            <SortTh label="Project" k="name" sort={sort} onSort={toggle} />
            {showType && <SortTh label="Type" k="type" sort={sort} onSort={toggle} />}
            <SortTh label="Company" k="company" sort={sort} onSort={toggle} />
            <SortTh label="Progress" k="progress" sort={sort} onSort={toggle} className="w-40" />
            <SortTh label="Current step" k="step" sort={sort} onSort={toggle} />
            <th className="w-0" />
            {showChecklist && <SortTh label="Checklist" k="checklist" sort={sort} onSort={toggle} />}
            {showCount &&<SortTh label="Count" k="count" sort={sort} onSort={toggle} />}
            <SortTh label="Deadline" k="deadline" sort={sort} onSort={toggle} />
            <SortTh label="To do" k="todo" sort={sort} onSort={toggle} className="text-right" />
            <th>Status</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const { done, total, pct } = projectProgress(p.steps);
            const href = `/project/${p._id}`;
            return (
              <tr key={p._id} className={`cursor-pointer ${p.priority ? "bg-[#ffd60a]/[0.06]" : ""}`} onClick={() => router.push(href)} {...rowProps?.(p)}>
                <td className="w-0 !pr-0"><StarButton p={p} /></td>
                <td className="max-w-72">
                  <Link href={href} className="flex min-w-0 items-center gap-2 font-semibold hover:text-accent" onClick={(e) => e.stopPropagation()}>
                    <TypeIcon icon={p.type?.icon} size="sm" />
                    <span className="truncate">{projectTitle(p)}</span>
                  </Link>
                </td>
                {showType && <td className="whitespace-nowrap text-muted">{p.type?.name}</td>}
                <td className="max-w-40 truncate text-muted">{p.company?.name || "—"}</td>
                <td>
                  {total > 0 ? (
                    <div className="flex items-center gap-2">
                      <ProgressBar value={pct} className="w-20" />
                      <span className="text-xs whitespace-nowrap text-muted">{done}/{total}</span>
                    </div>
                  ) : <span className="text-xs text-muted">Tasks only</span>}
                </td>
                <td className="max-w-56"><CurrentStep steps={p.steps} status={p.status} nameOf={nameOf} /></td>
                <td className="w-0" onClick={(e) => e.stopPropagation()}><DoingButton p={p} /></td>
                {showChecklist && <td className="max-w-52"><ChecklistCell p={p} /></td>}
                {showCount && <td className="whitespace-nowrap"><CountCell c={countSummary(p.steps)} /></td>}
                <td>{p.deadline ? <DeadlineBadge date={p.deadline} done={p.status === "completed"} /> : <span className="text-muted">—</span>}</td>
                <td className="text-right tabular-nums">{total - done || <span className="text-muted">0</span>}</td>
                <td><StatusChip status={p.status} /></td>
                <td className="text-muted"><ChevronRight className="h-4 w-4" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
    </>
  );
}

/** Phones: one compact row per project. */
export default function ProjectCard({ p }: { p: Project }) {
  const { done, total, pct } = projectProgress(p.steps);
  const current = workingStep(p.steps);
  const count = countText(countSummary(p.steps));
  const checks = checklistText(p);
  return (
    <div className="flex items-center gap-1 border-b border-line/70 pr-3 pl-1 last:border-0">
      <StarButton p={p} />
      <Link href={`/project/${p._id}`} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-1 active:bg-panel2">
        <TypeIcon icon={p.type?.icon} size="md" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <p className="truncate text-[0.8125rem] font-semibold">{projectTitle(p)}</p>
            {p.status !== "active" && <StatusChip status={p.status} />}
          </div>
          <p className="truncate text-[0.6875rem] text-muted">
            {[p.type?.name, p.company?.name].filter(Boolean).join(" · ")}
            {current && p.status !== "completed" ? ` · ${current.status === "doing" ? "Now" : "Next"}: ${current.title}` : ""}
          </p>
          {count && <p className="truncate text-[0.6875rem] font-semibold text-fg/80 tabular-nums">{count}</p>}
          {checks && <p className="truncate text-[0.6875rem] text-muted">{checks}</p>}
          {/* No hover on phones: the current step's details stand in for the hover card. */}
          {current?.note && p.status !== "completed" && <p className="truncate text-[0.6875rem] text-muted">{current.note}</p>}
          {total > 0 && (
            <div className="mt-1 flex items-center gap-1.5">
              <ProgressBar value={pct} className="max-w-28" />
              <span className="text-[0.625rem] text-muted">{done}/{total}</span>
            </div>
          )}
        </div>
        <DeadlineBadge date={p.deadline} done={p.status === "completed"} />
      </Link>
      <DoingButton p={p} />
    </div>
  );
}
