"use client";

import { useState } from "react";
import { Check, ListChecks, Plus } from "lucide-react";
import { ProgressBar } from "@/components/ui/bits";
import { api, fmtDate, refresh } from "@/lib/client";
import { toastError } from "@/lib/toast";
import { checklistEnabled, checklistStatus } from "@/lib/workflow";
import type { Project } from "@/lib/types";

/** Whether a project's page gets the checklist panel: its type has the checklist switched on and configured. */
export const showsChecklist = (p: Project) => checklistEnabled(p.type);

/** The project's tick boxes, for the right-hand side of the project page. */
export default function ChecklistPanel({ p, onChange }: { p: Project; onChange: (p: Project) => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const items = p.checklist || [];
  const have = new Set(items.map((c) => c.title.trim().toLowerCase()));
  const missing = (p.type?.checklist || []).filter((c) => !have.has(c.title.trim().toLowerCase())).length;
  const { done, total, next } = checklistStatus(items);

  async function call(key: string, init: Parameters<typeof api>[1]) {
    setBusy(key);
    try {
      onChange(await api<Project>(`/api/projects/${p._id}/checklist`, init));
      refresh("/api/projects?");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(null);
    }
  }

  return (
    <aside className="card !p-0 xl:sticky xl:top-3">
      <div className="border-b border-line px-3 py-2.5">
        <p className="flex items-center gap-1.5 text-[0.8125rem] font-bold">
          <ListChecks className="h-4 w-4 text-accent" />Checklist
          {total > 0 && <span className="ml-auto text-xs font-semibold text-muted tabular-nums">{done}/{total}</span>}
        </p>
        {total > 0 && <ProgressBar value={Math.round((done / total) * 100)} className="mt-2" />}
      </div>
      {items.length > 0 && (
        <ul className="p-1.5">
          {items.map((c) => {
            const isNext = next?.id === c.id;
            return (
              <li key={c.id}>
                <label className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 transition-colors ${
                  isNext ? "bg-accent-soft/50" : "hover:bg-panel2"
                } ${busy === c.id ? "opacity-60" : ""}`}>
                  <input type="checkbox" className="sr-only" checked={c.done} disabled={!!busy}
                    onChange={(e) => call(c.id, { method: "PATCH", body: { itemId: c.id, done: e.target.checked } })} />
                  <span aria-hidden className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${c.done ? "border-accent bg-accent text-[var(--accent-fg)]" : isNext ? "border-accent" : "border-line"}`}>
                    {c.done && <Check className="h-3 w-3" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-[0.8125rem] leading-snug ${c.done ? "text-muted line-through" : "font-semibold"}`}>{c.title}</span>
                    {c.done && c.doneAt && <span className="block text-[0.625rem] text-muted">{c.doneByName} · {fmtDate(c.doneAt)}</span>}
                  </span>
                  {isNext && <span className="chip shrink-0 bg-accent-soft text-accent">Next</span>}
                </label>
              </li>
            );
          })}
        </ul>
      )}
      {total > 0 && !next && <p className="px-3 pb-2.5 text-xs font-semibold text-accent">Everything ticked ✓</p>}
      {missing > 0 && (
        <div className={items.length ? "border-t border-line p-2" : "p-3"}>
          {!items.length && <p className="mb-2 text-xs text-muted">This project was made before the {p.type?.name} checklist was set up.</p>}
          <button className="btn-soft btn-sm w-full justify-center" disabled={!!busy} onClick={() => call("add", { method: "POST" })}>
            <Plus className="h-3 w-3" />{items.length ? `Add ${missing} new item${missing === 1 ? "" : "s"}` : `Add the checklist (${missing} items)`}
          </button>
        </div>
      )}
    </aside>
  );
}
