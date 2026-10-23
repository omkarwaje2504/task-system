"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Building, FolderInput, ListChecks, Pencil, Trash } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import Modal from "@/components/ui/Modal";
import { AvatarStack, EmptyState, Field, Skeleton } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import FilesPanel from "@/components/projects/FilesPanel";
import { SampleFormModal, SampleStatusChip, WorkingButton, sampleTitle } from "@/components/samples/SampleBits";
import { api, fmtDate, refresh, timeAgo, useApi, useMe, useTypes } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { PICKABLE, SAMPLE_STATUS } from "@/lib/samples";
import type { Project } from "@/lib/types";

/** The client went ahead: make it a project (with or without the type's template steps). */
function ConvertModal({ p, onClose }: { p: Project; onClose: () => void }) {
  const router = useRouter();
  const { data: types = [] } = useTypes();
  const steps = types.find((t) => t._id === p.type?._id)?.steps || [];
  const [useTemplate, setUseTemplate] = useState(true);
  const [deadline, setDeadline] = useState("");
  const [saving, setSaving] = useState(false);

  async function convert() {
    setSaving(true);
    try {
      await api(`/api/samples/${p._id}/convert`, { body: { useTemplate, deadline: deadline || null } });
      toast.success("🎉 It's a project now.");
      refresh("/api/samples", "/api/projects", "/api/dashboard");
      router.push(`/project/${p._id}`);
    } catch (e) {
      toastError(e);
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Convert to project" subtitle="The client approved the sample. Its files and history come along."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={convert} disabled={saving}><FolderInput className="h-4 w-4" />{saving ? "Converting…" : "Convert to project"}</button></>}>
      <Field label="Deadline" optional><input type="date" className="input !w-auto" value={deadline} onChange={(e) => setDeadline(e.target.value)} /></Field>
      {steps.length > 0 ? (
        <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-line px-2.5 py-2">
          <input type="checkbox" className="mt-0.5 accent-accent" checked={useTemplate} onChange={(e) => setUseTemplate(e.target.checked)} />
          <span>
            <span className="flex items-center gap-1.5 text-xs font-bold"><ListChecks className="h-3.5 w-3.5 text-accent" />Use the {p.type?.name} template ({steps.length} steps)</span>
            <span className="block text-[0.6875rem] text-muted">{steps.map((s) => s.title).join(" → ")}</span>
          </span>
        </label>
      ) : <p className="rounded-lg bg-panel2 px-3 py-2 text-xs text-muted">{p.type?.name} has no step template — you&apos;ll add the tasks one by one.</p>}
    </Modal>
  );
}

export default function SamplePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const nameOf = useUserName();
  const { data: me } = useMe();
  const { data: p, mutate, error } = useApi<Project>(`/api/samples/${id}`);
  const [editing, setEditing] = useState(false);
  const [converting, setConverting] = useState(false);

  if (error) return <div className="card"><EmptyState title="This sample doesn't exist anymore." action={<Link className="btn-primary" href="/samples">Back to samples</Link>} /></div>;
  if (!p) return <div className="space-y-2"><Skeleton className="h-24" /><Skeleton className="h-64" /></div>;
  // Converted: it lives on as a project.
  if (!p.sample) {
    return (
      <div className="card">
        <EmptyState title="This sample became a project." hint={p.convertedAt ? `Converted ${fmtDate(p.convertedAt)}.` : undefined}
          action={<Link className="btn-primary" href={`/project/${p._id}`}>Open the project</Link>} />
      </div>
    );
  }

  const workers = (p.workers || []).map(nameOf).filter(Boolean);
  async function setStatus(sampleStatus: string) {
    try {
      await mutate(await api<Project>(`/api/samples/${id}`, { method: "PATCH", body: { sampleStatus } }), { revalidate: false });
      refresh("/api/samples");
    } catch (e) {
      toastError(e);
    }
  }
  async function remove() {
    if (!(await confirmDialog("Delete this sample?", { danger: true, confirmLabel: "Delete sample" }))) return;
    try {
      await api(`/api/samples/${id}`, { method: "DELETE" });
      refresh("/api/samples");
      router.push("/samples");
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <div>
      <Link href="/samples" className="mb-2 inline-flex items-center gap-1 text-xs font-semibold text-muted hover:text-fg"><ArrowLeft className="h-3.5 w-3.5" />Samples</Link>

      <div className="card mb-3 !p-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <TypeIcon icon={p.type?.icon} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-lg leading-tight font-extrabold tracking-tight">{sampleTitle(p)}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="chip bg-panel2 text-muted">Sample</span>
                <span className="chip bg-accent-soft text-accent">{p.type?.name}</span>
                {p.company?.name && <span className="chip bg-panel2 text-muted"><Building className="h-3 w-3" />{p.company.name}</span>}
                <SampleStatusChip status={p.sampleStatus} />
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {workers.length > 0 && <span className="flex items-center gap-1.5 text-xs text-muted" title={workers.join(", ")}><AvatarStack names={workers} size="sm" />working{p.workingSince ? ` · ${timeAgo(p.workingSince)}` : ""}</span>}
            <WorkingButton p={p} onDone={(next) => mutate(next, { revalidate: false })} />
            <button className="btn-ghost btn-sm" onClick={() => setEditing(true)}><Pencil className="h-3 w-3" />Edit</button>
            <button className="btn-primary btn-sm" onClick={() => setConverting(true)}><FolderInput className="h-3.5 w-3.5" />Convert to project</button>
            {(me?.role === "admin" || me?.id === p.createdBy) && (
              <button className="icon-btn !h-7 !w-7 hover:!text-danger" onClick={remove} aria-label="Delete sample"><Trash className="h-3.5 w-3.5" /></button>
            )}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs font-semibold text-muted">Status</span>
          {PICKABLE.map((k) => (
            <button key={k} onClick={() => k !== p.sampleStatus && setStatus(k)}
              className={`chip !py-1 ${p.sampleStatus === k ? SAMPLE_STATUS[k].cls : "bg-transparent text-muted ring-1 ring-line hover:text-fg"}`}>
              {SAMPLE_STATUS[k].label}
            </button>
          ))}
        </div>
        {p.notes
          ? <p className="mt-3 rounded-md bg-panel2 px-2.5 py-2 text-[0.8125rem] whitespace-pre-wrap">{p.notes}</p>
          : <button className="mt-3 text-xs font-semibold text-muted hover:text-accent" onClick={() => setEditing(true)}>+ Add a description</button>}
      </div>

      {/* Done designs for the client — same uploads & previews as projects */}
      <FilesPanel projectId={p._id} />

      <p className="mt-3 px-1 text-[0.6875rem] text-muted">Asked for by {p.createdByName || "someone"} · {fmtDate(p.createdAt, { day: "numeric", month: "short", year: "numeric" })}</p>

      {editing && <SampleFormModal sample={p} onClose={() => setEditing(false)} onSaved={(next) => mutate(next, { revalidate: false })} />}
      {converting && <ConvertModal p={p} onClose={() => setConverting(false)} />}
    </div>
  );
}
