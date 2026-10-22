"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Pencil, Trash } from "lucide-react";
import { AvatarStack, DeadlineBadge, People } from "@/components/ui/bits";
import { TypeBadge } from "@/components/ui/TypeIcon";
import { useUserName } from "@/components/ui/UserPicker";
import { api } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { Task } from "@/lib/types";

const projectIdOf = (t: Task) => (typeof t.project === "object" && t.project ? t.project._id : null);
const projectLabel = (t: Task) =>
  [t.brandName, typeof t.project === "object" ? t.project?.theme : ""].filter(Boolean).join(" — ") || t.typeName || "Project";

/** Checkbox + delete logic shared by the row and table layouts. */
function useTaskActions(task: Task, onChange: () => void) {
  const [done, setDone] = useState(task.status === "done");
  async function toggle() {
    const next = !done;
    setDone(next);
    try {
      await api(`/api/tasks/${task._id}`, { method: "PUT", body: { status: next ? "done" : "open" } });
      if (next) toast.success("Nice! Task done.");
      onChange();
    } catch (e) {
      setDone(!next);
      toastError(e);
    }
  }
  async function remove() {
    if (!(await confirmDialog("Delete this task?", { danger: true, confirmLabel: "Delete" }))) return;
    try {
      await api(`/api/tasks/${task._id}`, { method: "DELETE" });
      onChange();
    } catch (e) {
      toastError(e);
    }
  }
  return { done, toggle, remove };
}

function CheckBox({ done, onClick }: { done: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} aria-label={done ? "Mark as not done" : "Mark as done"}
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 transition-colors ${done ? "border-accent bg-accent text-[var(--accent-fg)]" : "border-line hover:border-accent"}`}>
      {done && <Check className="h-3 w-3" strokeWidth={3.5} />}
    </button>
  );
}

function RowActions({ task, onEdit, remove }: { task: Task; onEdit?: (t: Task) => void; remove: () => void }) {
  return (
    <div className="flex shrink-0 sm:opacity-0 sm:group-hover:opacity-100">
      {onEdit && <button className="icon-btn !h-6 !w-6" onClick={() => onEdit(task)} aria-label="Edit task"><Pencil className="h-3 w-3" /></button>}
      <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={remove} aria-label="Delete task"><Trash className="h-3 w-3" /></button>
    </div>
  );
}

/** Compact list line — phones and narrow side panels. */
export default function TaskRow({ task, onChange, onEdit, showProject = true }: { task: Task; onChange: () => void; onEdit?: (t: Task) => void; showProject?: boolean }) {
  const nameOf = useUserName();
  const { done, toggle, remove } = useTaskActions(task, onChange);
  const projectId = projectIdOf(task);
  return (
    <div className="group flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-panel2/60">
      <CheckBox done={done} onClick={toggle} />
      <div className="min-w-0 flex-1">
        <p className={`truncate text-[13px] ${done ? "text-muted line-through" : ""}`}>{task.title}</p>
        {((showProject && projectId) || task.dueDate) && (
          <div className="mt-0.5 flex min-w-0 flex-wrap items-center gap-1">
            {showProject && projectId && (
              <Link href={`/project/${projectId}`} className="min-w-0 hover:opacity-80"><TypeBadge type={{ name: projectLabel(task), icon: task.typeIcon }} /></Link>
            )}
            <DeadlineBadge date={task.dueDate} done={done} />
          </div>
        )}
      </div>
      <AvatarStack names={task.assignees.map(nameOf).filter(Boolean)} size="xs" />
      <RowActions task={task} onEdit={onEdit} remove={remove} />
    </div>
  );
}

/** Desktop table row — used inside <TasksTable>. */
function TaskTr({ task, onChange, onEdit }: { task: Task; onChange: () => void; onEdit?: (t: Task) => void }) {
  const nameOf = useUserName();
  const { done, toggle, remove } = useTaskActions(task, onChange);
  const projectId = projectIdOf(task);
  return (
    <tr className="group">
      <td className="w-8 !pr-0"><CheckBox done={done} onClick={toggle} /></td>
      <td className={`max-w-96 ${done ? "text-muted line-through" : ""}`}><span className="line-clamp-1">{task.title}</span></td>
      <td className="max-w-64">
        {projectId ? <Link href={`/project/${projectId}`} className="flex min-w-0 hover:opacity-80"><TypeBadge type={{ name: projectLabel(task), icon: task.typeIcon }} /></Link> : <span className="text-muted">—</span>}
      </td>
      <td className="max-w-52"><People names={task.assignees.map(nameOf).filter(Boolean)} /></td>
      <td>{task.dueDate ? <DeadlineBadge date={task.dueDate} done={done} /> : <span className="text-muted">—</span>}</td>
      <td className="max-w-32 truncate text-xs text-muted">{task.createdByName || ""}</td>
      <td className="w-16 !px-1"><RowActions task={task} onEdit={onEdit} remove={remove} /></td>
    </tr>
  );
}

export function TasksTable({ groups, onChange, onEdit }: { groups: { title?: string; tone?: string; items: Task[] }[]; onChange: () => void; onEdit?: (t: Task) => void }) {
  return (
    <div className="card overflow-x-auto !p-0">
      <table className="tbl">
        <thead>
          <tr><th /><th>Task</th><th>Project</th><th>Assigned</th><th>Due</th><th>Added by</th><th /></tr>
        </thead>
        {groups.map((g, i) => (
          <tbody key={g.title || i}>
            {g.title && (
              <tr className="hover:!bg-transparent">
                <td colSpan={7} className={`bg-panel2/40 !py-1 text-[11px] font-bold tracking-wide uppercase ${g.tone || "text-muted"}`}>
                  {g.title} <span className="font-semibold text-muted">· {g.items.length}</span>
                </td>
              </tr>
            )}
            {g.items.map((t) => <TaskTr key={t._id} task={t} onChange={onChange} onEdit={onEdit} />)}
          </tbody>
        ))}
      </table>
    </div>
  );
}
