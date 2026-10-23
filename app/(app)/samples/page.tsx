"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FlaskConical, Paperclip, Plus } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { AvatarStack, EmptyState, PageHeader, PageIcon, SearchInput, Segmented, SortTh, TableSkeleton, useSort } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import { SampleFormModal, SampleStatusChip, WorkingButton, sampleTitle } from "@/components/samples/SampleBits";
import { timeAgo, useApi } from "@/lib/client";
import type { Project } from "@/lib/types";

const VIEWS = [
  { key: "open", label: "Open" },
  { key: "converted", label: "Became projects" },
  { key: "declined", label: "Declined" },
  { key: "all", label: "All" },
];

/** Samples a client asked for — kept apart from projects until they're converted. */
export default function SamplesPage() {
  const router = useRouter();
  const nameOf = useUserName();
  const [view, setView] = useState("open");
  const [q, setQ] = useState("");
  const [creating, setCreating] = useState(false);
  const { data, isLoading, mutate } = useApi<Project[]>(`/api/samples?status=${view}`);

  const list = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (data || []).filter((p) => !term || [p.theme, p.notes, p.brand?.name, p.company?.name, p.type?.name].some((v) => v?.toLowerCase().includes(term)));
  }, [data, q]);
  const { sorted, sort, toggle } = useSort(list, {
    name: (p) => sampleTitle(p), type: (p) => p.type?.name, company: (p) => p.company?.name,
    status: (p) => p.sampleStatus, added: (p) => p.createdAt,
  }, "samples");
  const href = (p: Project) => (p.sample ? `/samples/${p._id}` : `/project/${p._id}`);

  return (
    <>
      <PageHeader title="Samples" subtitle="Samples clients asked for. Convert one when the client goes ahead — until then it isn't a project."
        icon={<PageIcon><FlaskConical /></PageIcon>}
        actions={<button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New sample</button>} />

      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <Segmented items={VIEWS} value={view} onChange={setView} />
        <SearchInput value={q} onChange={setQ} placeholder="Search brand, company, type…" />
        {data && <span className="text-xs text-muted sm:ml-auto">{sorted.length} sample{sorted.length === 1 ? "" : "s"}</span>}
      </div>

      {isLoading && !data ? <TableSkeleton /> : sorted.length === 0 ? (
        <div className="card">
          <EmptyState icon={<FlaskConical />} title={q ? "Nothing matches." : view === "open" ? "No open samples." : "Nothing here yet."}
            hint={!q && view === "open" ? "When a client asks for a sample, add it here." : undefined}
            action={!q && view === "open" && <button className="btn-primary" onClick={() => setCreating(true)}><Plus className="h-4 w-4" />New sample</button>} />
        </div>
      ) : (
        <>
          <div className="card hidden overflow-x-auto !p-0 lg:block">
            <table className="tbl">
              <thead>
                <tr>
                  <SortTh label="Sample" k="name" sort={sort} onSort={toggle} />
                  <SortTh label="Type" k="type" sort={sort} onSort={toggle} />
                  <SortTh label="Company" k="company" sort={sort} onSort={toggle} />
                  <SortTh label="Status" k="status" sort={sort} onSort={toggle} />
                  <th>Working</th><th>Files</th>
                  <SortTh label="Added" k="added" sort={sort} onSort={toggle} />
                  <th className="w-0" />
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => {
                  const workers = (p.workers || []).map(nameOf).filter(Boolean);
                  return (
                    <tr key={p._id} className="cursor-pointer" onClick={() => router.push(href(p))}>
                      <td className="max-w-80">
                        <Link href={href(p)} onClick={(e) => e.stopPropagation()} className="flex min-w-0 items-center gap-2 font-semibold hover:text-accent">
                          {p.cover
                            // eslint-disable-next-line @next/next/no-img-element -- R2 thumbnail
                            ? <img src={p.cover.thumb} alt="" className="h-8 w-8 shrink-0 rounded-lg border border-line object-cover" />
                            : <TypeIcon icon={p.type?.icon} size="sm" />}
                          <span className="min-w-0">
                            <span className="block truncate">{sampleTitle(p)}</span>
                            {p.notes && <span className="block truncate text-[0.6875rem] font-normal text-muted">{p.notes}</span>}
                          </span>
                        </Link>
                      </td>
                      <td className="whitespace-nowrap text-muted">{p.type?.name}</td>
                      <td className="max-w-40 truncate text-muted">{p.company?.name || "—"}</td>
                      <td><SampleStatusChip status={p.sampleStatus} /></td>
                      <td>{workers.length ? <span title={workers.join(", ")}><AvatarStack names={workers} size="xs" /></span> : <span className="text-muted">—</span>}</td>
                      <td className="text-muted">{p.fileCount ? <span className="flex items-center gap-1"><Paperclip className="h-3 w-3" />{p.fileCount}</span> : "—"}</td>
                      <td className="text-xs whitespace-nowrap text-muted">{timeAgo(p.createdAt)}{p.createdByName ? ` · ${p.createdByName}` : ""}</td>
                      <td className="w-0" onClick={(e) => e.stopPropagation()}><WorkingButton p={p} onDone={() => mutate()} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="card overflow-hidden !p-0 lg:hidden">
            {sorted.map((p) => (
              <div key={p._id} className="flex items-center gap-2 border-b border-line/70 pr-3 last:border-0">
                <Link href={href(p)} className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-3 active:bg-panel2">
                  <TypeIcon icon={p.type?.icon} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[0.8125rem] font-semibold">{sampleTitle(p)}</span>
                    <span className="block truncate text-[0.6875rem] text-muted">{[p.type?.name, p.company?.name, p.fileCount && `${p.fileCount} files`].filter(Boolean).join(" · ")}</span>
                    <span className="mt-0.5 block"><SampleStatusChip status={p.sampleStatus} /></span>
                  </span>
                </Link>
                <WorkingButton p={p} onDone={() => mutate()} />
              </div>
            ))}
          </div>
        </>
      )}

      {creating && <SampleFormModal onClose={() => setCreating(false)} onSaved={(p) => router.push(`/samples/${p._id}`)} />}
    </>
  );
}
