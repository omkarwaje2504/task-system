"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { CalendarClock, CircleCheck, FolderKanban, ImagePlus, Plus, Rocket, SquareCheckBig, TriangleAlert, type LucideIcon } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { Avatar, DeadlineBadge, EmptyState, ProgressBar, Skeleton } from "@/components/ui/bits";
import NewProjectModal from "@/components/projects/NewProjectModal";
import { projectTitle } from "@/components/projects/ProjectCard";
import StepRowItem from "@/components/projects/StepRowItem";
import GeneralTasksPanel from "@/components/tasks/GeneralTasks";
import { greeting, timeAgo, useApi, useHydrated, useMe, useTypes } from "@/lib/client";
import { projectProgress } from "@/lib/workflow";
import type { Activity, Project, StepRow } from "@/lib/types";

type Dash = {
  stats: { active: number; dueSoon: number; overdue: number; completed30: number; myOpenSteps: number };
  mySteps: StepRow[];
  team: TeamMember[];
  upcoming: Project[];
  byType: { _id: string; count: number; name: string; slug: string; icon: string; special: boolean }[];
  activity: Activity[];
};

type WorkItem = {
  /** A sample someone marked "I'm working" on (not a project step). */
  sample?: boolean;
  step: { id: string; title: string; status: string; dueDate: string | null; note?: string; updatedAt?: string; module?: string };
  project: { _id: string; theme: string; legacyName?: string };
  brand?: string;
  typeIcon?: string;
  typeName?: string;
};
type TeamMember = { id: string; name: string; team: string; open: number; overdue: number; doing: WorkItem[] };

const workProject = (w: WorkItem) => [w.brand, w.project.theme].filter(Boolean).join(" — ") || w.project.legacyName || w.typeName || "Project";

function WorkLine({ w }: { w: WorkItem }) {
  return (
    <Link href={w.sample ? `/samples/${w.project._id}` : `/project/${w.project._id}`} className="block rounded-lg px-1.5 py-1 hover:bg-panel2/60">
      <span className="flex min-w-0 items-center gap-1.5 text-xs">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
        <span className="truncate font-semibold">{w.step.title}</span>
        {w.sample && <span className="chip shrink-0 bg-accent-soft text-accent">Sample</span>}
        {w.step.dueDate && <span className="ml-auto shrink-0"><DeadlineBadge date={w.step.dueDate} /></span>}
      </span>
      <span className="block truncate pl-3 text-[0.6875rem] text-muted">
        {w.sample ? w.typeName || "Sample" : workProject(w)}{w.step.module ? ` › ${w.step.module}` : ""}{w.step.updatedAt ? ` · ${timeAgo(w.step.updatedAt)}` : ""}
      </span>
      {w.step.note && <span className="line-clamp-2 pl-3 text-[0.6875rem] text-fg/75">{w.step.note}</span>}
    </Link>
  );
}

/** Who's working on what: only steps people marked with "I'm doing", newest first. */
function TeamPanel({ team }: { team: TeamMember[] }) {
  return (
    <Panel title="Who's working on what" action={<span className="text-[0.6875rem] text-muted">{team.length ? `${team.length} working now` : "From the “I'm doing” button"}</span>}>
      {team.length === 0 ? (
        <Empty>Nobody is on anything right now. Press <b>I&apos;m doing</b> on a project to show what you&apos;re working on.</Empty>
      ) : (
        <div className="grid gap-1.5 p-0.5 md:grid-cols-2">
          {team.map((m) => (
            <div key={m.id} className="rounded-xl border border-line/70 p-2">
              <div className="mb-1 flex items-center gap-2">
                <Avatar name={m.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.8125rem] font-bold">{m.name}</span>
                  {m.team && <span className="block truncate text-[0.625rem] text-muted capitalize">{m.team}</span>}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="chip bg-panel2 text-muted">{m.open} open</span>
                  {m.overdue > 0 && <span className="chip bg-danger/10 text-danger">{m.overdue} late</span>}
                </span>
              </div>
              {m.doing.map((w) => <WorkLine key={`${w.project._id}-${w.step.id}`} w={w} />)}
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}

function Stat({ label, value, icon: Icon, danger, href }: { label: string; value?: number; icon: LucideIcon; danger?: boolean; href: string }) {
  const alert = danger && !!value;
  return (
    <Link href={href} className="flex items-center gap-2.5 px-3 py-2.5 shadow-[1px_0_0_var(--line),0_1px_0_var(--line)] transition-colors hover:bg-panel2/60">
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
        <h2 className="text-[0.8125rem] font-extrabold">{title}</h2>
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
            {data && ` · ${data.stats.myOpenSteps} step${data.stats.myOpenSteps === 1 ? "" : "s"} waiting on you`}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button onClick={() => setCreating(true)} className="btn-primary"><Plus className="h-3.5 w-3.5" />New project</button>
          <Link href="/tasks" className="btn-ghost"><SquareCheckBig className="h-3.5 w-3.5" />My steps</Link>
          {firstAssetType && <Link href={`/assets/${firstAssetType.slug}`} className="btn-ghost"><ImagePlus className="h-3.5 w-3.5" />Designs</Link>}
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-panel lg:grid-cols-4">
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
            <TeamPanel team={data.team} />
            <Panel title="Your next steps" action={<Link href="/tasks" className="text-[0.6875rem] font-bold text-accent hover:underline">See all {data.stats.myOpenSteps}</Link>}>
              {data.mySteps.length === 0
                ? <Empty>Nothing assigned to you right now. Enjoy! ☕</Empty>
                : data.mySteps.map((r) => <StepRowItem key={`${r.project._id}-${r.step.id}`} row={r} onChange={() => mutate()} />)}
            </Panel>
            <Suspense><GeneralTasksPanel /></Suspense>

            <Panel title="Coming up" action={<span className="text-[0.6875rem] text-muted">Nearest deadlines</span>} flush>
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
                            <td className="hidden md:table-cell">{prog.total > 0 && <div className="flex items-center gap-1.5"><ProgressBar value={prog.pct} /><span className="text-[0.6875rem] text-muted">{prog.done}/{prog.total}</span></div>}</td>
                            <td className="text-right"><DeadlineBadge date={p.deadline} /></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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
