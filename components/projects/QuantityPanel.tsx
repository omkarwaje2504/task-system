"use client";

import { useState } from "react";
import { Settings2, Trash } from "lucide-react";
import { ProgressBar } from "@/components/ui/bits";
import { api, fmtDate, todayISO, useApi, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import type { ProjectStep, StepData } from "@/lib/workflow";

type Log = { _id: string; date: string; added: number; completed: number; declined: number; note: string; userName: string; user: string };

const NUM = "input text-center font-bold tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none";

/** RxPad-style daily count: added / completed / declined per day, with running totals. */
export default function QuantityPanel({ projectId, step, onSaveSettings, onChanged }: {
  projectId: string;
  step: ProjectStep;
  onSaveSettings: (data: Partial<StepData>) => void;
  onChanged: () => void;
}) {
  const { data: me } = useMe();
  const { data: logs = [], mutate } = useApi<Log[]>(`/api/projects/${projectId}/progress?step=${step.id}`);
  const [form, setForm] = useState({ date: todayISO(), added: "", completed: "", declined: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState(false);
  const unit = step.data.unit || "pcs";
  const t = step.data.totals || { added: 0, completed: 0, declined: 0 };
  const pending = Math.max(0, t.added - t.completed - t.declined);
  const target = step.data.target || 0;

  async function save() {
    setSaving(true);
    try {
      await api(`/api/projects/${projectId}/progress`, { body: { stepId: step.id, ...form } });
      toast.success("Today's count saved.");
      setForm({ date: todayISO(), added: "", completed: "", declined: "", note: "" });
      mutate();
      onChanged();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  async function remove(l: Log) {
    if (!(await confirmDialog(`Remove the entry for ${fmtDate(l.date)}?`, { danger: true, confirmLabel: "Remove" }))) return;
    try {
      await api(`/api/projects/${projectId}/progress/${l._id}`, { method: "DELETE" });
      mutate();
      onChanged();
    } catch (e) {
      toastError(e);
    }
  }

  const tiles = [
    { label: "Added", value: t.added, cls: "" },
    { label: "Completed", value: t.completed, cls: "text-accent" },
    { label: "Declined", value: t.declined, cls: "text-danger" },
    { label: "Pending", value: pending, cls: "" },
  ];

  return (
    <div className="mt-2 space-y-2">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-panel sm:grid-cols-4">
        {tiles.map((x) => (
          <div key={x.label} className="px-3 py-1.5 shadow-[1px_0_0_var(--line),0_1px_0_var(--line)]">
            <p className="text-[0.6875rem] font-semibold text-muted">{x.label}</p>
            <p className={`text-base font-extrabold tabular-nums ${x.cls}`}>{x.value.toLocaleString()} <span className="text-[0.6875rem] font-semibold text-muted">{unit}</span></p>
          </div>
        ))}
      </div>
      {target > 0 && (
        <div className="flex items-center gap-2 text-[0.6875rem] font-semibold text-muted">
          <span className="whitespace-nowrap">Target {target.toLocaleString()} {unit}</span>
          <ProgressBar value={(t.completed / target) * 100} />
          <span>{Math.round((t.completed / target) * 100)}%</span>
        </div>
      )}

      <div className="rounded-lg border border-line p-2">
        <div className="mb-1.5 flex items-center justify-between">
          <p className="text-xs font-bold">Log a day</p>
          <button className="btn-ghost btn-sm" onClick={() => setSettings(!settings)}><Settings2 className="h-3 w-3" />Unit & target</button>
        </div>
        {settings && (
          <div className="animate-pop mb-2 grid grid-cols-2 gap-2 rounded-md bg-panel2 p-2">
            <label className="text-[0.6875rem] font-semibold text-muted">Unit
              <input className="input mt-0.5" defaultValue={unit} onBlur={(e) => e.target.value.trim() !== unit && onSaveSettings({ unit: e.target.value })} placeholder="RxPad" />
            </label>
            <label className="text-[0.6875rem] font-semibold text-muted">Target (optional)
              <input type="number" min={0} className="input mt-0.5" defaultValue={target || ""} onBlur={(e) => Number(e.target.value) !== target && onSaveSettings({ target: Number(e.target.value) || null })} />
            </label>
          </div>
        )}
        <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-[repeat(3,minmax(0,90px))_auto_minmax(0,1fr)_auto] lg:items-end">
          {(["added", "completed", "declined"] as const).map((k) => (
            <label key={k} className="text-[0.6875rem] font-semibold text-muted capitalize">{k}
              <input type="number" min={0} inputMode="numeric" className={`${NUM} mt-0.5`} placeholder="0" value={form[k]}
                onChange={(e) => setForm({ ...form, [k]: e.target.value })} />
            </label>
          ))}
          <input type="date" className="input col-span-3 lg:col-span-1 lg:!w-auto" value={form.date} max={todayISO()} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          <input className="input col-span-2 lg:col-span-1" placeholder="Note (optional)" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} />
          <button className="btn-primary" onClick={save} disabled={saving || (!form.added && !form.completed && !form.declined)}>{saving ? "Saving…" : "Save"}</button>
        </div>
      </div>

      {logs.length > 0 && (
        <div className="max-h-64 overflow-y-auto rounded-lg border border-line">
          <table className="tbl">
            <thead className="sticky top-0">
              <tr>
                <th>Date</th>
                <th className="hidden sm:table-cell">By</th>
                <th className="text-right">Added</th>
                <th className="text-right">Done</th>
                <th className="text-right">Declined</th>
                <th className="hidden sm:table-cell">Note</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l._id}>
                  <td className="font-semibold whitespace-nowrap">{fmtDate(l.date)}</td>
                  <td className="hidden text-muted sm:table-cell">{l.userName}</td>
                  <td className="text-right tabular-nums">{l.added || "—"}</td>
                  <td className="text-right font-semibold text-accent tabular-nums">{l.completed || "—"}</td>
                  <td className="text-right text-danger tabular-nums">{l.declined || "—"}</td>
                  <td className="hidden max-w-48 truncate text-muted sm:table-cell" title={l.note}>{l.note}</td>
                  <td className="!px-1 text-right">
                    {(me?.role === "admin" || me?.id === l.user) && (
                      <button className="icon-btn !h-6 !w-6 hover:!text-danger" onClick={() => remove(l)} aria-label="Remove entry"><Trash className="h-3 w-3" /></button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
