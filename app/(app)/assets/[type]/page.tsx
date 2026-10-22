"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ImagePlus, Images, LayoutGrid, List, Pencil, Play } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { EmptyState, PageHeader, SearchInput, Segmented, SortTh, TableSkeleton, Tabs, useSort } from "@/components/ui/bits";
import { AssetFormModal, AssetViewer, coverOf } from "@/components/assets/AssetModals";
import { fmtDate, useApi, useTypes } from "@/lib/client";
import type { Asset, AssetFile } from "@/lib/types";

function Thumb({ file, className = "" }: { file?: AssetFile; className?: string }) {
  if (!file) return <span className={`flex items-center justify-center bg-panel2 text-muted ${className}`}><Images className="h-4 w-4" /></span>;
  return (
    <span className={`relative block overflow-hidden bg-panel2 ${className}`}>
      {file.kind === "video" ? (
        <>
          <video src={file.url} className="h-full w-full object-cover" muted playsInline />
          <Play className="absolute top-1/2 left-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />
        </>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- user uploads on an arbitrary R2 domain
        <img src={file.url} alt={file.slot} loading="lazy" className="h-full w-full object-cover" />
      )}
    </span>
  );
}

export default function AssetLibrary() {
  const { type: slug } = useParams<{ type: string }>();
  const { data: types = [], isLoading: typesLoading } = useTypes();
  const { data: assets, isLoading, mutate } = useApi<Asset[]>(`/api/assets?type=${slug}`);
  const [q, setQ] = useState("");
  const [view, setView] = useState<"table" | "gallery">("table");
  const [adding, setAdding] = useState(false);
  const [viewing, setViewing] = useState<Asset | null>(null);
  const [editing, setEditing] = useState<Asset | null>(null);
  const type = types.find((t) => t.slug === slug);
  const tabs = types.filter((t) => t.assetTab);
  const slots = type?.assetSlots.length ? type.assetSlots : ["Cover", "Front", "Back"];

  const shown = useMemo(() => {
    const term = q.trim().toLowerCase();
    return (assets || []).filter((a) => !term || [a.title, a.description, ...a.tags].some((v) => v?.toLowerCase().includes(term)));
  }, [assets, q]);
  const { sorted, sort, toggle } = useSort(shown, {
    title: (a) => a.title, by: (a) => a.createdByName, date: (a) => -new Date(a.createdAt).getTime(),
  });

  if (!type && !typesLoading) {
    return <div className="card"><EmptyState title="This library doesn't exist." action={<Link className="btn-primary" href="/assets">See all libraries</Link>} /></div>;
  }

  const gallery = (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-6">
      {sorted.map((a) => (
        <button key={a._id} onClick={() => setViewing(a)} className="card group flex flex-col overflow-hidden !p-0 text-left transition-colors hover:border-accent">
          <span className="relative">
            <Thumb file={coverOf(a)} className="aspect-[4/5] w-full" />
            {a.files.length > 1 && <span className="chip absolute right-1.5 bottom-1.5 bg-black/60 text-white">{a.files.length}</span>}
          </span>
          <span className="px-2 py-1.5">
            <span className="block truncate text-[13px] font-semibold group-hover:text-accent">{a.title}</span>
            {a.description && <span className="block truncate text-[11px] text-muted">{a.description}</span>}
          </span>
        </button>
      ))}
    </div>
  );

  return (
    <>
      <PageHeader title={`${type?.name || ""} designs`} subtitle="Every theme the team has made — reuse, don't redo."
        icon={type && <TypeIcon icon={type.icon} size="lg" />}
        actions={type && <button className="btn-primary" onClick={() => setAdding(true)}><ImagePlus className="h-3.5 w-3.5" />Add design</button>} />

      <Tabs active={slug} items={tabs.map((t) => ({ key: t.slug, label: t.name, href: `/assets/${t.slug}`, icon: <TypeIcon icon={t.icon} size="xs" /> }))} />

      <div className="mb-3 flex items-center gap-2">
        <SearchInput value={q} onChange={setQ} placeholder="Search themes, tags…" />
        {assets && <span className="ml-auto text-xs text-muted">{shown.length} design{shown.length === 1 ? "" : "s"}</span>}
        <div className="hidden lg:block">
          <Segmented value={view} onChange={setView} items={[
            { key: "table", label: <span className="flex items-center gap-1"><List className="h-3.5 w-3.5" />Table</span> },
            { key: "gallery", label: <span className="flex items-center gap-1"><LayoutGrid className="h-3.5 w-3.5" />Gallery</span> },
          ]} />
        </div>
      </div>

      {isLoading && !assets ? (
        <TableSkeleton />
      ) : shown.length === 0 ? (
        <div className="card">
          <EmptyState icon={<Images />} title={q ? "No designs match." : "No designs yet."}
            hint={q ? undefined : `Add your first ${type?.name} theme with its ${slots.join(", ").toLowerCase()}.`}
            action={!q && <button className="btn-primary" onClick={() => setAdding(true)}><ImagePlus className="h-3.5 w-3.5" />Add design</button>} />
        </div>
      ) : (
        <>
          <div className="lg:hidden">{gallery}</div>
          <div className="hidden lg:block">
            {view === "gallery" ? gallery : (
              <div className="card overflow-x-auto !p-0">
                <table className="tbl">
                  <thead>
                    <tr>
                      {slots.map((s) => <th key={s} className="w-14">{s}</th>)}
                      <SortTh label="Theme" k="title" sort={sort} onSort={toggle} />
                      <th>Description</th>
                      <th>Tags</th>
                      <SortTh label="Added by" k="by" sort={sort} onSort={toggle} />
                      <SortTh label="Added" k="date" sort={sort} onSort={toggle} />
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {sorted.map((a) => (
                      <tr key={a._id} className="cursor-pointer" onClick={() => setViewing(a)}>
                        {slots.map((s) => <td key={s} className="!py-1.5"><Thumb file={a.files.find((f) => f.slot === s)} className="h-12 w-10 rounded" /></td>)}
                        <td className="font-semibold">{a.title}</td>
                        <td className="max-w-72 truncate text-muted">{a.description || "—"}</td>
                        <td className="max-w-48">
                          <span className="flex flex-wrap gap-1">{a.tags.length ? a.tags.map((t) => <span key={t} className="chip bg-panel2 text-muted">#{t}</span>) : <span className="text-muted">—</span>}</span>
                        </td>
                        <td className="whitespace-nowrap text-muted">{a.createdByName}</td>
                        <td className="whitespace-nowrap text-muted">{fmtDate(a.createdAt)}</td>
                        <td className="w-10 !px-1">
                          <button className="icon-btn !h-7 !w-7" aria-label={`Edit ${a.title}`} onClick={(e) => { e.stopPropagation(); setEditing(a); }}><Pencil className="h-3.5 w-3.5" /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {adding && type && <AssetFormModal type={type} onClose={() => setAdding(false)} onSaved={() => mutate()} />}
      {editing && type && <AssetFormModal type={type} asset={editing} onClose={() => setEditing(null)} onSaved={() => mutate()} />}
      {viewing && <AssetViewer asset={viewing} onClose={() => setViewing(null)} onEdit={() => { setEditing(viewing); setViewing(null); }} onDeleted={() => mutate()} />}
    </>
  );
}
