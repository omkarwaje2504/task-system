"use client";

import { useMemo, useState } from "react";
import { SquareCheckBig } from "lucide-react";
import { EmptyState, PageHeader, PageIcon, SearchInput, Segmented, TableSkeleton } from "@/components/ui/bits";
import TaskRow, { TasksTable } from "@/components/tasks/TaskRow";
import { QuickAddTask, TaskEditModal } from "@/components/tasks/TaskForm";
import { daysUntil, refresh, useApi } from "@/lib/client";
import type { Task } from "@/lib/types";

type View = "mine" | "all" | "done";
const VIEWS: { key: View; label: string; url: string }[] = [
  { key: "mine", label: "My tasks", url: "/api/tasks?mine=1&status=open" },
  { key: "all", label: "Everyone's", url: "/api/tasks?status=open" },
  { key: "done", label: "Done", url: "/api/tasks?mine=1&status=done" },
];

function group(tasks: Task[]) {
  const groups: { title: string; tone: string; items: Task[] }[] = [
    { title: "Overdue", tone: "text-danger", items: [] },
    { title: "Today", tone: "text-accent", items: [] },
    { title: "This week", tone: "text-fg", items: [] },
    { title: "Later", tone: "text-fg", items: [] },
    { title: "No due date", tone: "text-muted", items: [] },
  ];
  for (const t of tasks) {
    if (!t.dueDate) groups[4].items.push(t);
    else {
      const d = daysUntil(t.dueDate);
      groups[d < 0 ? 0 : d === 0 ? 1 : d <= 7 ? 2 : 3].items.push(t);
    }
  }
  return groups.filter((g) => g.items.length);
}

export default function TasksPage() {
  const [view, setView] = useState<View>("mine");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Task | null>(null);
  const { data, isLoading, mutate } = useApi<Task[]>(VIEWS.find((v) => v.key === view)!.url);

  const tasks = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((t) => !term || t.title.toLowerCase().includes(term) || t.brandName?.toLowerCase().includes(term));
  }, [data, q]);
  const groups = view === "done" ? [{ items: tasks }] : group(tasks);

  const reload = () => {
    mutate();
    refresh("/api/dashboard");
  };

  return (
    <>
      <PageHeader title="Tasks" subtitle="Small to-dos — tick them off as you go." icon={<PageIcon><SquareCheckBig /></PageIcon>} />

      <div className="mb-3"><QuickAddTask onAdded={reload} /></div>

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented items={VIEWS} value={view} onChange={setView} />
        <SearchInput value={q} onChange={setQ} placeholder="Search tasks…" />
        {data && <span className="text-xs text-muted sm:ml-auto">{tasks.length} task{tasks.length === 1 ? "" : "s"}</span>}
      </div>

      {isLoading && !data ? (
        <TableSkeleton />
      ) : tasks.length === 0 ? (
        <div className="card">
          <EmptyState icon={<SquareCheckBig />}
            title={q ? "No tasks match." : view === "done" ? "Nothing finished yet." : "All clear! 🎉"}
            hint={view === "mine" && !q ? "No open tasks for you. Add one above when something comes up." : undefined} />
        </div>
      ) : (
        <>
          <div className="hidden lg:block"><TasksTable groups={groups} onChange={reload} onEdit={setEditing} /></div>
          <div className="space-y-3 lg:hidden">
            {groups.map((g, i) => (
              <section key={"title" in g ? g.title : i}>
                {"title" in g && <h2 className={`mb-1 px-1 text-[11px] font-bold tracking-wide uppercase ${g.tone}`}>{g.title} <span className="text-muted">· {g.items.length}</span></h2>}
                <div className="card !p-1">{g.items.map((t) => <TaskRow key={t._id} task={t} onChange={reload} onEdit={setEditing} />)}</div>
              </section>
            ))}
          </div>
        </>
      )}

      {editing && <TaskEditModal task={editing} onClose={() => setEditing(null)} onSaved={reload} />}
    </>
  );
}
