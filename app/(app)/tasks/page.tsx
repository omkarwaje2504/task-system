"use client";

import { useMemo, useState } from "react";
import { SquareCheckBig } from "lucide-react";
import { EmptyState, PageHeader, PageIcon, SearchInput, Segmented, TableSkeleton } from "@/components/ui/bits";
import StepRowItem from "@/components/projects/StepRowItem";
import { daysUntil, refresh, useApi } from "@/lib/client";
import type { StepRow } from "@/lib/types";

// Steps are the tasks: this page lists project steps across all projects.
type View = "mine" | "all" | "done";
const VIEWS: { key: View; label: string; url: string }[] = [
  { key: "mine", label: "My steps", url: "/api/steps?mine=1" },
  { key: "all", label: "Everyone's", url: "/api/steps" },
  { key: "done", label: "Done", url: "/api/steps?mine=1&status=done&limit=200" },
];

function group(rows: StepRow[]) {
  const groups: { title: string; tone: string; items: StepRow[] }[] = [
    { title: "Overdue", tone: "text-danger", items: [] },
    { title: "Today", tone: "text-accent", items: [] },
    { title: "This week", tone: "text-fg", items: [] },
    { title: "Later", tone: "text-fg", items: [] },
    { title: "No due date", tone: "text-muted", items: [] },
  ];
  for (const r of rows) {
    const due = r.step.dueDate;
    if (!due) groups[4].items.push(r);
    else {
      const d = daysUntil(due);
      groups[d < 0 ? 0 : d === 0 ? 1 : d <= 7 ? 2 : 3].items.push(r);
    }
  }
  return groups.filter((g) => g.items.length);
}

export default function MyStepsPage() {
  const [view, setView] = useState<View>("mine");
  const [q, setQ] = useState("");
  const { data, isLoading, mutate } = useApi<StepRow[]>(VIEWS.find((v) => v.key === view)!.url);

  const rows = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((r) => !term || [r.step.title, r.step.note, r.brand?.name, r.project.theme, r.project.legacyName, r.type?.name]
      .some((v) => v?.toLowerCase().includes(term)));
  }, [data, q]);
  const groups = view === "done" ? [{ title: "", tone: "", items: rows }] : group(rows);

  const reload = () => {
    mutate();
    refresh("/api/dashboard");
  };

  return (
    <>
      <PageHeader title="My steps" subtitle="Project steps waiting on you. Add new ones inside each project." icon={<PageIcon><SquareCheckBig /></PageIcon>} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented items={VIEWS} value={view} onChange={setView} />
        <SearchInput value={q} onChange={setQ} placeholder="Search steps, brands, projects…" />
        {data && <span className="text-xs text-muted sm:ml-auto">{rows.length} step{rows.length === 1 ? "" : "s"}</span>}
      </div>

      {isLoading && !data ? (
        <TableSkeleton />
      ) : rows.length === 0 ? (
        <div className="card">
          <EmptyState icon={<SquareCheckBig />}
            title={q ? "No steps match." : view === "done" ? "Nothing finished yet." : "All clear! 🎉"}
            hint={view === "mine" && !q ? "Nothing is assigned to you. Steps you're put on in a project show up here." : undefined} />
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((g, i) => (
            <section key={g.title || i}>
              {g.title && <h2 className={`mb-1 px-1 text-[0.6875rem] font-bold tracking-wide uppercase ${g.tone}`}>{g.title} <span className="text-muted">· {g.items.length}</span></h2>}
              <div className="card !p-1">{g.items.map((r) => <StepRowItem key={`${r.project._id}-${r.step.id}`} row={r} onChange={reload} />)}</div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
