"use client";

import { useMemo, useState } from "react";
import { CalendarDays, FolderKanban, Plus } from "lucide-react";
import Modal from "@/components/ui/Modal";
import Combobox from "@/components/ui/Combobox";
import { Field } from "@/components/ui/bits";
import { UserMultiSelect } from "@/components/ui/UserPicker";
import { projectTitle } from "@/components/projects/ProjectCard";
import { api, useApi, useMe } from "@/lib/client";
import { toast, toastError } from "@/lib/toast";
import type { Project, Task } from "@/lib/types";

/** Inline "add a task" bar: type, pick people, press Enter. */
export function QuickAddTask({ projectId, onAdded, placeholder = "Add a task… e.g. “Send preview to client”" }: { projectId?: string; onAdded: () => void; placeholder?: string }) {
  const { data: me } = useMe();
  const [title, setTitle] = useState("");
  const [assignees, setAssignees] = useState<string[] | null>(null);
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const people = assignees ?? (me ? [me.id] : []);

  async function add() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await api("/api/tasks", { body: { title, assignees: people, project: projectId, dueDate: dueDate || null } });
      setTitle("");
      setDueDate("");
      onAdded();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-line bg-panel p-1.5">
      <div className="flex items-center gap-2">
        <Plus className="ml-1 h-4 w-4 shrink-0 text-accent" />
        <input className="min-w-0 flex-1 bg-transparent py-1 text-[13px] outline-none placeholder:text-muted" placeholder={placeholder}
          value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <button className="btn-primary btn-sm" onClick={add} disabled={saving || !title.trim()}>Add</button>
      </div>
      {title.trim() && (
        <div className="animate-pop mt-1.5 grid gap-1.5 border-t border-line pt-1.5 sm:grid-cols-[1fr_auto]">
          <UserMultiSelect value={people} onChange={setAssignees} placeholder="Who will do it?" />
          <label className="flex items-center gap-1.5 rounded-lg border border-line px-2 text-[13px] text-muted">
            <CalendarDays className="h-3.5 w-3.5" />
            <input type="date" className="bg-transparent py-1 text-fg outline-none" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </label>
        </div>
      )}
    </div>
  );
}

/** Full edit dialog — title, people, project link, due date. */
export function TaskEditModal({ task, onClose, onSaved }: { task: Task; onClose: () => void; onSaved: () => void }) {
  const { data: projects = [] } = useApi<Project[]>("/api/projects?type=all&status=active");
  const initialProject = typeof task.project === "object" && task.project ? task.project._id : typeof task.project === "string" ? task.project : "";
  const [title, setTitle] = useState(task.title);
  const [assignees, setAssignees] = useState<string[]>(task.assignees);
  const [dueDate, setDueDate] = useState(task.dueDate || "");
  const [projectId, setProjectId] = useState(initialProject);
  const options = useMemo(() => projects.map((p) => ({ value: p._id, label: projectTitle(p), hint: p.type?.name })), [projects]);
  const [projectText, setProjectText] = useState("");
  const shownText = projectText || options.find((o) => o.value === projectId)?.label || "";
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await api(`/api/tasks/${task._id}`, { method: "PUT", body: { title, assignees, dueDate: dueDate || null, project: projectId || null } });
      toast.success("Task saved.");
      onSaved();
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Edit task"
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={save} disabled={saving || !title.trim()}>{saving ? "Saving…" : "Save"}</button></>}>
      <Field label="What needs to be done?">
        <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      </Field>
      <Field label="Who will do it?">
        <UserMultiSelect value={assignees} onChange={setAssignees} />
      </Field>
      <Field label="Project" optional help="Clear the box to unlink.">
        <Combobox value={shownText} allowNew={false} options={options} placeholder="Search a project…" icon={<FolderKanban className="h-4 w-4" />}
          onChange={(v) => { setProjectText(v); if (!v) setProjectId(""); }}
          onPick={(o) => { setProjectId(o.value); setProjectText(""); }} />
      </Field>
      <Field label="Due date" optional>
        <input type="date" className="input !w-auto" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
      </Field>
    </Modal>
  );
}
