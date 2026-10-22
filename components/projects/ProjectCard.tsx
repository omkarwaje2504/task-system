"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar, DeadlineBadge, ProgressBar, SortTh, useSort } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import { projectProgress } from "@/lib/workflow";
import type { Project } from "@/lib/types";

export function projectTitle(p: Pick<Project, "brand" | "theme" | "legacyName" | "type">) {
  return [p.brand?.name, p.theme].filter(Boolean).join(" — ") || p.legacyName || `${p.type?.name || ""} project`;
}

const STATUS_LABEL: Record<Project["status"], string> = { active: "In progress", "on-hold": "On hold", completed: "Completed" };

export function StatusChip({ status }: { status: Project["status"] }) {
  const cls = status === "completed" ? "bg-accent text-[var(--accent-fg)]" : status === "on-hold" ? "bg-panel2 text-muted" : "bg-accent-soft text-accent";
  return <span className={`chip ${cls}`}>{STATUS_LABEL[status]}</span>;
}

/** Desktop: sortable table, whole row clickable. */
export function ProjectsTable({ projects, showType = true }: { projects: Project[]; showType?: boolean }) {
  const router = useRouter();
  const nameOf = useUserName();
  const { sorted, sort, toggle } = useSort(projects, {
    name: (p) => projectTitle(p),
    type: (p) => p.type?.name,
    company: (p) => p.company?.name,
    progress: (p) => projectProgress(p.steps).pct,
    deadline: (p) => p.deadline,
    tasks: (p) => p.openTasks || 0,
  });

  return (
    <div className="card overflow-x-auto !p-0">
      <table className="tbl">
        <thead>
          <tr>
            <SortTh label="Project" k="name" sort={sort} onSort={toggle} />
            {showType && <SortTh label="Type" k="type" sort={sort} onSort={toggle} />}
            <SortTh label="Company" k="company" sort={sort} onSort={toggle} />
            <SortTh label="Progress" k="progress" sort={sort} onSort={toggle} className="w-40" />
            <th>Next step</th>
            <SortTh label="Deadline" k="deadline" sort={sort} onSort={toggle} />
            <SortTh label="Tasks" k="tasks" sort={sort} onSort={toggle} className="text-right" />
            <th>Status</th>
            <th className="w-6" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((p) => {
            const { done, total, pct, current } = projectProgress(p.steps);
            const href = `/project/${p._id}`;
            return (
              <tr key={p._id} className="cursor-pointer" onClick={() => router.push(href)}>
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
                <td className="max-w-56">
                  {current && p.status !== "completed" ? (
                    <span className="flex min-w-0 items-center gap-1.5">
                      {current.assignee && <Avatar name={nameOf(current.assignee)} size="xs" />}
                      <span className="truncate">{current.title}</span>
                    </span>
                  ) : <span className="text-muted">—</span>}
                </td>
                <td>{p.deadline ? <DeadlineBadge date={p.deadline} done={p.status === "completed"} /> : <span className="text-muted">—</span>}</td>
                <td className="text-right tabular-nums">{p.openTasks || <span className="text-muted">0</span>}</td>
                <td><StatusChip status={p.status} /></td>
                <td className="text-muted"><ChevronRight className="h-4 w-4" /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Phones: one compact row per project. */
export default function ProjectCard({ p }: { p: Project }) {
  const { done, total, pct, current } = projectProgress(p.steps);
  return (
    <Link href={`/project/${p._id}`} className="flex items-center gap-2.5 border-b border-line/70 px-3 py-2.5 last:border-0 active:bg-panel2">
      <TypeIcon icon={p.type?.icon} size="md" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <p className="truncate text-[13px] font-semibold">{projectTitle(p)}</p>
          {p.status !== "active" && <StatusChip status={p.status} />}
        </div>
        <p className="truncate text-[11px] text-muted">
          {[p.type?.name, p.company?.name].filter(Boolean).join(" · ")}
          {current && p.status !== "completed" ? ` · Next: ${current.title}` : ""}
        </p>
        {total > 0 && (
          <div className="mt-1 flex items-center gap-1.5">
            <ProgressBar value={pct} className="max-w-28" />
            <span className="text-[10px] text-muted">{done}/{total}</span>
          </div>
        )}
      </div>
      <DeadlineBadge date={p.deadline} done={p.status === "completed"} />
    </Link>
  );
}
