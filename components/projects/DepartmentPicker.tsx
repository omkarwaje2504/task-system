"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { api, refresh, useDepartments } from "@/lib/client";
import { toastError } from "@/lib/toast";
import type { Department, Project } from "@/lib/types";

/** Toggle any number of departments; "+ Other…" adds a new one for everyone. */
export default function DepartmentPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const { data: departments = [] } = useDepartments();
  const [draft, setDraft] = useState("");
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  async function add() {
    const name = draft.trim();
    if (!name) return;
    try {
      const d = await api<Department>("/api/departments", { body: { name } });
      await refresh("/api/departments");
      if (!value.includes(d._id)) onChange([...value, d._id]);
      setDraft("");
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <div className="flex flex-wrap gap-1">
      {departments.map((d) => {
        const on = value.includes(d._id);
        return (
          <button key={d._id} type="button" onClick={() => toggle(d._id)} aria-pressed={on}
            className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold transition-colors ${on ? "border-accent bg-accent text-[var(--accent-fg)]" : "border-line text-muted hover:text-fg"}`}>
            {on && <Check className="h-3 w-3" />}{d.name}
          </button>
        );
      })}
      <input className="input !w-28 !py-0.5 !text-xs" placeholder="+ Other…" value={draft} aria-label="Add a department"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }} />
    </div>
  );
}

/** The project's departments as names, in the departments' own order. */
export function useProjectDepartments(p: Pick<Project, "departments">) {
  const { data: departments = [] } = useDepartments();
  return departments.filter((d) => p.departments?.includes(d._id));
}
