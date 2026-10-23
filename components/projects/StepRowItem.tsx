"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, CircleDot } from "lucide-react";
import TypeIcon from "@/components/ui/TypeIcon";
import { AvatarStack, DeadlineBadge } from "@/components/ui/bits";
import { useUserName } from "@/components/ui/UserPicker";
import { api, fmtDate, refresh } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import { STEP_KINDS, stepPeople } from "@/lib/workflow";
import type { StepRow } from "@/lib/types";

const projectLabel = (r: StepRow) => [r.brand?.name, r.project.theme].filter(Boolean).join(" — ") || r.project.legacyName || r.type?.name || "Project";

/** A step out of its project (My steps, dashboard): tick it off or jump to the project. */
export default function StepRowItem({ row, onChange }: { row: StepRow; onChange: () => void }) {
  const nameOf = useUserName();
  const [busy, setBusy] = useState(false);
  const { step, project } = row;
  const done = step.status === "done";
  const names = stepPeople(step).map(nameOf).filter(Boolean);

  async function toggle() {
    setBusy(true);
    try {
      await api(`/api/projects/${project._id}/steps/${step.id}`, { method: "PATCH", body: { status: done ? "todo" : "done" } });
      if (!done) toast.success(`“${step.title}” done.`);
      onChange();
      refresh("/api/projects", "/api/dashboard", "/api/steps");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-panel2/50">
      <button onClick={toggle} disabled={busy} aria-label={done ? "Mark as not done" : "Mark as done"}
        className={`tap flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 ${done ? "border-accent bg-accent text-white" : "border-line hover:border-accent"}`}>
        {done && <Check className="h-3 w-3" strokeWidth={3} />}
      </button>
      <Link href={`/project/${project._id}`} className="flex min-w-0 flex-1 items-center gap-2 hover:text-accent">
        <TypeIcon icon={row.type?.icon} size="sm" />
        <span className="min-w-0">
          <span className={`flex items-center gap-1.5 truncate text-[0.8125rem] font-semibold ${done ? "text-muted line-through" : ""}`}>
            {step.status === "doing" && <CircleDot className="h-3 w-3 shrink-0 text-accent" />}
            <span className="truncate">{step.title}</span>
          </span>
          <span className="block truncate text-[0.6875rem] text-muted">
            {[projectLabel(row), step.module, step.kind !== "check" && STEP_KINDS[step.kind].label, done && step.doneAt && `done ${fmtDate(step.doneAt)}`, !done && step.note].filter(Boolean).join(" · ")}
          </span>
        </span>
      </Link>
      {names.length > 0 && <span className="hidden sm:block" title={names.join(", ")}><AvatarStack names={names} size="xs" /></span>}
      {step.dueDate && <DeadlineBadge date={step.dueDate} done={done} />}
    </div>
  );
}
