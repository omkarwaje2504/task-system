"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FolderKanban, LayoutGrid, Plus } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { EmptyState, PageHeader, PageIcon, SearchInput, Segmented, TableSkeleton, Tabs } from "@/components/ui/bits";
import ProjectCard, { ProjectsTable, priorityFirst } from "./ProjectCard";
import NewProjectModal from "./NewProjectModal";
import { useProjectHover } from "./ProjectHoverCard";
import { useApi, useTypes } from "@/lib/client";
import type { Project } from "@/lib/types";

const STATUSES: { key: string; label: string }[] = [
  { key: "active", label: "In progress" },
  { key: "on-hold", label: "On hold" },
  { key: "completed", label: "Completed" },
  { key: "all", label: "All" },
];

export default function ProjectsView({ typeSlug }: { typeSlug: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { data: types = [] } = useTypes();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [subType, setSubType] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const hover = useProjectHover();

  // "+ New" in the sidebar links here with ?new=1.
  useEffect(() => {
    if (params.get("new") === "1") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot: open the modal, then clean the URL
      setCreating(true);
      router.replace(pathname);
    }
  }, [params, pathname, router]);

  const { data: projects, isLoading } = useApi<Project[]>(`/api/projects?type=${typeSlug}&status=${status}`);
  const type = types.find((t) => t.slug === typeSlug);
  const special = types.filter((t) => t.special);

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (projects || []).filter((p) =>
      (!subType || p.type?._id === subType) &&
      (!term || [p.theme, p.brand?.name, p.company?.name, p.type?.name, p.legacyName].some((v) => v?.toLowerCase().includes(term))),
    );
  }, [projects, q, subType]);

  // In "Others", let people narrow down by product type.
  const otherTypes = useMemo(() => {
    if (typeSlug !== "others") return [];
    const seen = new Map<string, { _id: string; name: string; icon: string; n: number }>();
    for (const p of projects || []) {
      if (!p.type) continue;
      const cur = seen.get(p.type._id);
      if (cur) cur.n++;
      else seen.set(p.type._id, { ...p.type, n: 1 });
    }
    return [...seen.values()].sort((a, b) => b.n - a.n);
  }, [projects, typeSlug]);

  const title = typeSlug === "all" ? "All projects" : typeSlug === "others" ? "Other projects" : `${type?.name || ""} projects`;
  const subtitle = typeSlug === "others" ? "Every product type that doesn't have its own tab." : typeSlug === "all" ? "Everything the team is working on." : type?.steps.length ? `${type.steps.length} guided steps per project.` : undefined;
  const icon = type
    ? <TypeIcon icon={type.icon} size="lg" />
    : <PageIcon>{typeSlug === "others" ? <LayoutGrid /> : <FolderKanban />}</PageIcon>;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} icon={icon}
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New project</button>} />

      <Tabs active={typeSlug} items={[
        { key: "all", label: "All", href: "/projects/all" },
        ...special.map((t) => ({ key: t.slug, label: t.name, href: `/projects/${t.slug}`, icon: <TypeIcon icon={t.icon} size="xs" /> })),
        { key: "others", label: "Others", href: "/projects/others" },
      ]} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <SearchInput value={q} onChange={setQ} placeholder="Search brand, company, theme…" />
        <Segmented items={STATUSES} value={status} onChange={setStatus} />
        {projects && <span className="text-xs text-muted sm:ml-auto">{shown.length} project{shown.length === 1 ? "" : "s"}</span>}
      </div>

      {otherTypes.length > 1 && (
        <div className="no-scrollbar -mx-3 mb-3 flex gap-1 overflow-x-auto px-3 sm:mx-0 sm:flex-wrap sm:px-0">
          <button onClick={() => setSubType(null)} className={`chip shrink-0 ${!subType ? "bg-accent text-[var(--accent-fg)]" : "bg-panel2 text-muted"}`}>All types</button>
          {otherTypes.map((t) => (
            <button key={t._id} onClick={() => setSubType(subType === t._id ? null : t._id)}
              className={`chip shrink-0 ${subType === t._id ? "bg-accent text-[var(--accent-fg)]" : "bg-panel2 text-muted hover:text-fg"}`}>
              {t.name} <span className="opacity-60">{t.n}</span>
            </button>
          ))}
        </div>
      )}

      {isLoading && !projects ? (
        <TableSkeleton />
      ) : shown.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={type ? <TypeIcon icon={type.icon} /> : undefined}
            title={q ? "Nothing matches your search." : status === "completed" ? "No completed projects yet." : "No projects here yet."}
            hint={q ? "Try a different word." : "Start one — you'll get a checklist of steps to follow."}
            action={!q && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New project</button>}
          />
        </div>
      ) : (
        <>
          <div className="hidden lg:block"><ProjectsTable projects={shown} showType={!type} rowProps={hover.rowProps} /></div>
          {hover.card}
          <div className="card overflow-hidden !p-0 lg:hidden">{priorityFirst(shown).map((p) => <ProjectCard key={p._id} p={p} />)}</div>
        </>
      )}

      {creating && <NewProjectModal open onClose={() => setCreating(false)} initialTypeSlug={type?.slug} />}
    </>
  );
}
