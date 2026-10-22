"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleCheck, FolderKanban, ImagePlus, Plus, Rocket, SquareCheckBig, TriangleAlert, type LucideIcon } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar, DeadlineBadge, EmptyState, ProgressBar, Skeleton } from "@/components/ui/bits";
import NewProjectModal from "@/components/projects/NewProjectModal";
import { projectTitle } from "@/components/projects/ProjectCard";
import TaskRow from "@/components/tasks/TaskRow";
import { greeting, timeAgo, useApi, useHydrated, useMe, useTypes } from "@/lib/client";
import { projectProgress, type ProjectStep } from "@/lib/workflow";
import type { Activity, Project, Task, TypeRef } from "@/lib/types";

type Dash = {
  stats: { active: number; dueSoon: number; overdue: number; completed30: number; myOpenTasks: number };
  myTasks: (Task & { theme?: string })[];
  mySteps: { _id: string; theme: string; deadline: string | null; step: ProjectStep; type: TypeRef; brand?: { name: string } }[];
  upcoming: Project[];
  byType: { _id: string; count: number; name: string; slug: string; icon: string; special: boolean }[];
  activity: Activity[];
};

function Stat({ label, value, icon: Icon, danger, href }: { label: string; value?: number; icon: LucideIcon; danger?: boolean; href: string }) {
  const alert = danger && !!value;
  return (
    <Link href={href} className="flex items-center gap-2.5 bg-panel px-3 py-2.5 transition-colors hover:bg-panel2/60">
      <Icon className={`h-4 w-4 shrink-0 ${alert ? "text-danger" : "text-accent"}`} />
      <span className="min-w-0 flex-1 text-xs leading-tight font-semibold text-muted">{label}</span>
      <span className={`text-lg leading-none font-extrabold tabular-nums ${alert ? "text-danger" : ""}`}>{value ?? "–"}</span>
    </Link>
  );
}

function Panel({ title, action, children, flush = false }: { title: string; action?: React.ReactNode; children: React.ReactNode; flush?: boolean }) {
  return (
    <section className="card overflow-hidden !p-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 border-b border-line px-3 py-2">
        <h2 className="text-[13px] font-extrabold">{title}</h2>
        {action}
      </div>
      <div className={flush ? "" : "p-1.5"}>{children}</div>
    </section>
  );
}

const Empty = ({ children }: { children: React.ReactNode }) => <p className="px-3 py-4 text-center text-xs text-muted">{children}</p>;

export default function Dashboard() {
  const { data: me } = useMe();
  const { data: types = [] } = useTypes();
  const { data, mutate } = useApi<Dash>("/api/dashboard");
  const [creating, setCreating] = useState(false);
  const hydrated = useHydrated();
  const firstAssetType = types.find((t) => t.assetTab);
  const maxType = Math.max(1, ...(data?.byType.map((t) => t.count) || [1]));

  return (
    <>
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-lg leading-tight font-extrabold tracking-tight sm:text-xl">{hydrated ? greeting() : "Hello"}, {me?.name.split(" ")[0] || "there"} 👋</h1>
          <p className="text-xs text-muted">
            {hydrated && new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" })}
            {data && ` · ${data.stats.myOpenTasks} open task${data.stats.myOpenTasks === 1 ? "" : "s"}, ${data.mySteps.length} step${data.mySteps.length === 1 ? "" : "s"} waiting on you`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-3.5 w-3.5" />New project</button>
          <Link href="/tasks" className="btn-ghost"><SquareCheckBig className="h-3.5 w-3.5" />My tasks</Link>
          {firstAssetType && <Link href={`/assets/${firstAssetType.slug}`} className="btn-ghost"><ImagePlus className="h-3.5 w-3.5" />Designs</Link>}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line lg:grid-cols-4">
        <Stat label="Projects in progress" value={data?.stats.active} icon={FolderKanban} href="/projects/all" />
        <Stat label="Due in next 7 days" value={data?.stats.dueSoon} icon={CalendarClock} href="/projects/all" />
        <Stat label="Overdue" value={data?.stats.overdue} icon={TriangleAlert} danger href="/projects/all" />
        <Stat label="Finished this month" value={data?.stats.completed30} icon={CircleCheck} href="/projects/all" />
      </div>

      {!data ? (
        <div className="grid gap-3 xl:grid-cols-2"><Skeleton className="h-56" /><Skeleton className="h-56" /></div>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] gap-3 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-3">
            <Panel title="Your next steps" action={<span className="text-[11px] text-muted">Project steps assigned to you</span>} flush>
              {data.mySteps.length === 0 ? <Empty>No project steps assigned to you right now.</Empty> : (
                <table className="tbl">
                  <tbody>
                    {data.mySteps.map((s) => (
                      <tr key={`${s._id}-${s.step.id}`}>
                        <td className="w-full max-w-0">
                          <Link href={`/project/${s._id}`} className="flex min-w-0 items-center gap-2 hover:text-accent">
                            <TypeIcon icon={s.type?.icon} size="sm" />
                            <span className="min-w-0">
                              <span className="block truncate font-semibold">{s.step.title}</span>
                              <span className="block truncate text-[11px] text-muted">{[s.brand?.name, s.theme].filter(Boolean).join(" — ") || s.type?.name}</span>
                            </span>
                          </Link>
                        </td>
                        <td className="text-right">{s.deadline && <DeadlineBadge date={s.deadline} />}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </Panel>

            <Panel title="Coming up" action={<span className="text-[11px] text-muted">Nearest deadlines</span>} flush>
              {data.upcoming.length === 0 ? <Empty>No deadlines set on active projects.</Empty> : (
                <div className="overflow-x-auto">
                  <table className="tbl">
                    <thead><tr><th>Project</th><th className="hidden sm:table-cell">Next step</th><th className="hidden w-32 md:table-cell">Progress</th><th className="text-right">Deadline</th></tr></thead>
                    <tbody>
                      {data.upcoming.map((p) => {
                        const prog = projectProgress(p.steps);
                        return (
                          <tr key={p._id}>
                            <td className="max-w-0 sm:max-w-64">
                              <Link href={`/project/${p._id}`} className="flex min-w-0 items-center gap-2 font-semibold hover:text-accent">
                                <TypeIcon icon={p.type?.icon} size="sm" /><span className="truncate">{projectTitle(p)}</span>
                              </Link>
                            </td>
                            <td className="hidden max-w-48 truncate text-muted sm:table-cell">{prog.current?.title || "All steps done"}</td>
                            <td className="hidden md:table-cell">{prog.total > 0 && <div className="flex items-center gap-1.5"><ProgressBar value={prog.pct} /><span className="text-[11px] text-muted">{prog.done}/{prog.total}</span></div>}</td>
                            <td className="text-right"><DeadlineBadge date={p.deadline} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Panel>

            <Panel title="My tasks" action={<Link href="/tasks" className="text-[11px] font-bold text-accent hover:underline">See all</Link>}>
              {data.myTasks.length === 0 ? <Empty>No open tasks. Enjoy! ☕</Empty> : data.myTasks.map((t) => (
                <TaskRow key={t._id} task={{ ...t, assignees: t.assignees || [], project: t.project ? { _id: String(t.project), theme: t.theme } : null }} onChange={() => mutate()} />
              ))}
            </Panel>
          </div>

          <div className="space-y-3">
            <Panel title="Active projects by type">
              {data.byType.length === 0 ? (
                <EmptyState icon={<Rocket />} title="No active projects" action={<button className="btn-primary btn-sm" onClick={() => setCreating(true)}><Plus className="h-3 w-3" />Start one</button>} />
              ) : (
                <div className="space-y-1 px-1.5 py-1">
                  {data.byType.map((t) => (
                    <Link key={t._id} href={t.special ? `/projects/${t.slug}` : "/projects/others"} className="group flex items-center gap-2 py-0.5">
                      <TypeIcon icon={t.icon} size="xs" />
                      <span className="w-24 shrink-0 truncate text-xs font-semibold group-hover:text-accent">{t.name}</span>
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-panel2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(t.count / maxType) * 100}%` }} />
                      </div>
                      <span className="w-6 text-right text-xs font-bold tabular-nums">{t.count}</span>
                    </Link>
                  ))}
                </div>
              )}
            </Panel>

            <Panel title="Recent activity">
              {data.activity.length === 0 ? <Empty>Nothing yet.</Empty> : (
                <ol className="space-y-2 px-1.5 py-1">
                  {data.activity.map((a) => (
                    <li key={a._id} className="flex gap-2 text-xs">
                      <Avatar name={a.userName} size="xs" className="mt-px" />
                      <p className="min-w-0 flex-1 leading-snug">
                        <span className="font-bold">{a.userName.split(" ")[0]}</span>{" "}
                        {a.project ? <Link href={`/project/${a.project}`} className="hover:text-accent">{a.message}</Link> : a.message}
                        <span className="text-muted"> · {timeAgo(a.createdAt)}</span>
                      </p>
                    </li>
                  ))}
                </ol>
              )}
            </Panel>
          </div>
        </div>
      )}

      {creating && <NewProjectModal open onClose={() => setCreating(false)} />}
    </>
  );
}
