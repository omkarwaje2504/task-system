"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BellRing, Check, CheckCheck, Eye, FileText, Loader2, MessageSquare, Paperclip, Plus, RotateCcw, Send, Trash, X, Zap } from "lucide-react";
import Modal from "@/components/ui/Modal";
import { Avatar, AvatarStack, Field } from "@/components/ui/bits";
import { UserMultiSelect, useUserName } from "@/components/ui/UserPicker";
import { api, refresh, timeAgo, uploadFile, useApi, useMe } from "@/lib/client";
import { confirmDialog } from "@/lib/confirm";
import { toast, toastError } from "@/lib/toast";
import { fileKind, fmtSize } from "@/lib/files";
import { ackedBy, needsMyAck, type GeneralTask, type TaskFile } from "@/lib/generalTasks";

// ---- Attachments ------------------------------------------------------------

/** Paperclip button: uploads picked files to R2 and hands back their records. */
function AttachButton({ onAdd, compact = false }: { onAdd: (files: TaskFile[]) => void; compact?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const [pct, setPct] = useState<number | null>(null);
  async function pick(list: FileList | null) {
    const files = Array.from(list || []);
    if (!files.length) return;
    try {
      const out: TaskFile[] = [];
      for (const [i, f] of files.entries()) {
        const url = await uploadFile(f, "tasks", (p) => setPct(Math.round(((i + p / 100) / files.length) * 100)));
        const kind = fileKind(f.name, f.type);
        out.push({ name: f.name, url, mime: f.type, size: f.size, kind, thumb: kind === "image" ? url : null });
      }
      onAdd(out);
    } catch (e) {
      toastError(e);
    } finally {
      setPct(null);
    }
  }
  return (
    <>
      <button type="button" className={compact ? "icon-btn !h-8 !w-8" : "btn-ghost btn-sm"} onClick={() => input.current?.click()} disabled={pct !== null}
        aria-label="Attach files" title="Attach files">
        {pct !== null ? <><Loader2 className="h-3.5 w-3.5 animate-spin" />{!compact && `${pct}%`}</> : <><Paperclip className="h-3.5 w-3.5" />{!compact && "Attach"}</>}
      </button>
      <input ref={input} type="file" multiple className="hidden" onChange={(e) => { pick(e.target.files); e.target.value = ""; }} />
    </>
  );
}

function FileChips({ files, onRemove }: { files: TaskFile[]; onRemove?: (i: number) => void }) {
  if (!files.length) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {files.map((f, i) => (
        <span key={`${f.url}-${i}`} className="flex max-w-full items-center gap-1.5 rounded-lg border border-line bg-panel2/60 py-1 pr-1.5 pl-1 text-[0.6875rem]">
          <a href={f.url} target="_blank" rel="noreferrer" className="flex min-w-0 items-center gap-1.5 hover:text-accent">
            {f.thumb
              // eslint-disable-next-line @next/next/no-img-element -- user uploads on the R2 domain
              ? <img src={f.thumb} alt="" className="h-7 w-7 shrink-0 rounded object-cover" />
              : <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded bg-panel"><FileText className="h-3.5 w-3.5 text-muted" /></span>}
            <span className="truncate font-semibold">{f.name}</span>
            {f.size > 0 && <span className="shrink-0 text-muted">{fmtSize(f.size)}</span>}
          </a>
          {onRemove && <button type="button" aria-label={`Remove ${f.name}`} className="text-muted hover:text-danger" onClick={() => onRemove(i)}><X className="h-3 w-3" /></button>}
        </span>
      ))}
    </div>
  );
}

// ---- New task ---------------------------------------------------------------

function NewTaskModal({ onClose }: { onClose: () => void }) {
  const [text, setText] = useState("");
  const [people, setPeople] = useState<string[]>([]);
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [saving, setSaving] = useState(false);
  async function save() {
    setSaving(true);
    try {
      await api("/api/general-tasks", { body: { text, assignees: people, files } });
      toast.success(`Task sent to ${people.length} ${people.length === 1 ? "person" : "people"} — they'll be reminded every minute until they acknowledge it.`);
      refresh("/api/general-tasks");
      onClose();
    } catch (e) {
      toastError(e);
    } finally {
      setSaving(false);
    }
  }
  return (
    <Modal open onClose={onClose} title="New priority task" icon={<Zap className="h-4 w-4" />}
      subtitle="Quick work for anyone. They get a notification and a reminder every minute until they acknowledge it."
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={save} disabled={saving || !text.trim() || !people.length}>{saving ? "Sending…" : "Send task"}</button></>}>
      <Field label="What's the task?">
        <textarea className="input" rows={4} autoFocus value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Send the Diwali frame files to the printer before 4 pm" />
      </Field>
      <Field label="Who should do it?" help="Pick one or more people.">
        <UserMultiSelect value={people} onChange={setPeople} placeholder="Assign people" />
      </Field>
      <Field label="Attachments" optional>
        <div className="space-y-2">
          <FileChips files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
          <AttachButton onAdd={(f) => setFiles([...files, ...f])} />
        </div>
      </Field>
    </Modal>
  );
}

// ---- Task detail ------------------------------------------------------------

function TaskModal({ task, onClose, onChange }: { task: GeneralTask; onClose: () => void; onChange: (t: GeneralTask) => void }) {
  const { data: me } = useMe();
  const nameOf = useUserName();
  const [comment, setComment] = useState("");
  const [files, setFiles] = useState<TaskFile[]>([]);
  const [busy, setBusy] = useState(false);
  const mine = !!me && (task.createdBy === me.id || me.role === "admin");
  const onIt = !!me && task.assignees.includes(me.id);
  const waiting = !!me && needsMyAck(task, me.id);

  async function patch(body: object, ok?: string) {
    setBusy(true);
    try {
      const next = await api<GeneralTask>(`/api/general-tasks/${task._id}`, { method: "PATCH", body });
      onChange(next);
      if (ok) toast.success(ok);
      refresh("/api/general-tasks");
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function send() {
    setBusy(true);
    try {
      const next = await api<GeneralTask>(`/api/general-tasks/${task._id}/comments`, { body: { text: comment, files } });
      onChange(next);
      setComment("");
      setFiles([]);
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  }

  async function removeComment(id: string) {
    try {
      onChange(await api<GeneralTask>(`/api/general-tasks/${task._id}/comments?commentId=${id}`, { method: "DELETE" }));
    } catch (e) {
      toastError(e);
    }
  }

  async function remove() {
    if (!(await confirmDialog("Delete this task? It disappears for everyone on it.", { confirmLabel: "Delete", danger: true }))) return;
    try {
      await api(`/api/general-tasks/${task._id}`, { method: "DELETE" });
      refresh("/api/general-tasks");
      onClose();
    } catch (e) {
      toastError(e);
    }
  }

  return (
    <Modal open onClose={onClose} size="lg" icon={<Zap className="h-4 w-4" />}
      title={task.done ? "Task (done)" : "Priority task"}
      subtitle={`From ${task.createdByName} · ${timeAgo(task.createdAt)}`}
      footer={
        <>
          {mine && <button className="btn-ghost mr-auto text-danger" onClick={remove}><Trash className="h-3.5 w-3.5" />Delete</button>}
          {(onIt || mine) && (task.done
            ? <button className="btn-ghost" disabled={busy} onClick={() => patch({ done: false }, "Task reopened.")}><RotateCcw className="h-3.5 w-3.5" />Reopen</button>
            : <button className="btn-ghost" disabled={busy} onClick={() => patch({ done: true }, "Task marked done.")}><CheckCheck className="h-3.5 w-3.5" />Mark done</button>)}
          {waiting && <button className="btn-primary" disabled={busy} onClick={() => patch({ ack: true }, "Acknowledged — reminders stopped.")}><Eye className="h-3.5 w-3.5" />Acknowledge</button>}
        </>
      }>
      {waiting && (
        <p className="task-flash mb-3 flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold">
          <BellRing className="bell-ring h-4 w-4 shrink-0" />Please acknowledge so {task.createdByName.split(" ")[0]} knows you&apos;ve seen it.
        </p>
      )}
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{task.text}</p>
      {task.files.length > 0 && <div className="mt-3"><FileChips files={task.files} /></div>}

      <div className="mt-4">
        <p className="section-title mb-1.5">People</p>
        <ul className="space-y-1">
          {task.assignees.map((id) => {
            const ack = task.acks.find((a) => a.user === id);
            return (
              <li key={id} className="flex items-center gap-2 text-xs">
                <Avatar name={nameOf(id)} size="xs" />
                <span className="flex-1 font-semibold">{nameOf(id) || "Someone"}</span>
                {ack
                  ? <span className="chip bg-accent-soft text-accent"><Check className="h-3 w-3" />Seen {timeAgo(ack.at)}</span>
                  : <span className="chip bg-danger/10 text-danger">Not seen yet</span>}
              </li>
            );
          })}
        </ul>
        {task.done && task.doneByName && <p className="mt-2 text-[0.6875rem] text-muted">Done by {task.doneByName}{task.doneAt ? ` · ${timeAgo(task.doneAt)}` : ""}</p>}
      </div>

      <div className="mt-4">
        <p className="section-title mb-1.5">Comments {task.comments.length > 0 && `(${task.comments.length})`}</p>
        <div className="space-y-2">
          {task.comments.length === 0 && <p className="text-xs text-muted">No comments yet.</p>}
          {task.comments.map((c) => (
            <div key={c.id} className="group flex gap-2">
              <Avatar name={c.userName} size="xs" className="mt-0.5" />
              <div className="min-w-0 flex-1 rounded-xl bg-panel2/60 px-2.5 py-1.5">
                <p className="flex items-center gap-1.5 text-[0.6875rem]">
                  <span className="font-bold">{c.userName}</span><span className="text-muted">{timeAgo(c.createdAt)}</span>
                  {me && (c.user === me.id || me.role === "admin") && (
                    <button className="ml-auto text-muted opacity-0 group-hover:opacity-100 hover:text-danger" aria-label="Delete comment" onClick={() => removeComment(c.id)}><Trash className="h-3 w-3" /></button>
                  )}
                </p>
                {c.text && <p className="text-xs whitespace-pre-wrap">{c.text}</p>}
                {c.files.length > 0 && <div className="mt-1"><FileChips files={c.files} /></div>}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-2 space-y-1.5">
          <FileChips files={files} onRemove={(i) => setFiles(files.filter((_, j) => j !== i))} />
          <div className="flex items-end gap-1.5">
            <textarea className="input flex-1" rows={2} value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Write a comment…"
              onKeyDown={(e) => e.key === "Enter" && (e.ctrlKey || e.metaKey) && (comment.trim() || files.length) && send()} />
            <AttachButton compact onAdd={(f) => setFiles([...files, ...f])} />
            <button className="btn-primary !h-8" disabled={busy || (!comment.trim() && !files.length)} onClick={send} aria-label="Send comment"><Send className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ---- Dashboard panel --------------------------------------------------------

function TaskRow({ t, onOpen }: { t: GeneralTask; onOpen: () => void }) {
  const { data: me } = useMe();
  const nameOf = useUserName();
  const waiting = !!me && needsMyAck(t, me.id);
  const seen = t.acks.length;
  const [busy, setBusy] = useState(false);

  async function ack(e: React.MouseEvent) {
    e.stopPropagation();
    setBusy(true);
    try {
      await api(`/api/general-tasks/${t._id}`, { method: "PATCH", body: { ack: true } });
      toast.success("Acknowledged — reminders stopped.");
      refresh("/api/general-tasks");
    } catch (err) {
      toastError(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div role="button" tabIndex={0} onClick={onOpen} onKeyDown={(e) => e.key === "Enter" && onOpen()}
      className={`flex cursor-pointer items-start gap-2.5 rounded-xl px-2 py-2 hover:bg-panel2/60 ${waiting ? "task-flash" : ""} ${t.done ? "opacity-60" : ""}`}>
      <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${t.done ? "bg-accent text-[var(--accent-fg)]" : waiting ? "bg-danger text-white" : "bg-accent-soft text-accent"}`}>
        {t.done ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : waiting ? <BellRing className="bell-ring h-3.5 w-3.5" /> : <Zap className="h-3.5 w-3.5" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`line-clamp-2 text-[0.8125rem] leading-snug ${t.done ? "line-through" : "font-semibold"}`}>{t.text}</span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.6875rem] text-muted">
          <span>From {t.createdBy === me?.id ? "you" : t.createdByName.split(" ")[0]} · {timeAgo(t.createdAt)}</span>
          <span className="flex items-center gap-1"><AvatarStack names={t.assignees.map(nameOf).filter(Boolean)} size="xs" />
            <span className={seen === t.assignees.length ? "text-accent" : ""}>{seen}/{t.assignees.length} seen</span>
          </span>
          {t.files.length > 0 && <span className="flex items-center gap-0.5"><Paperclip className="h-3 w-3" />{t.files.length}</span>}
          {t.comments.length > 0 && <span className="flex items-center gap-0.5"><MessageSquare className="h-3 w-3" />{t.comments.length}</span>}
        </span>
      </span>
      {waiting
        ? <button className="btn-primary btn-sm shrink-0" disabled={busy} onClick={ack}><Eye className="h-3.5 w-3.5" />Acknowledge</button>
        : me && t.assignees.includes(me.id) && ackedBy(t, me.id) && !t.done && <span className="chip shrink-0 bg-accent-soft text-accent"><Check className="h-3 w-3" />Seen</span>}
    </div>
  );
}

/** Dashboard: priority tasks given to me or by me. ?task=<id> opens one (from notifications). */
export default function GeneralTasksPanel() {
  const { data: me } = useMe();
  const { data: tasks, mutate } = useApi<GeneralTask[]>("/api/general-tasks");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const params = useSearchParams();
  const router = useRouter();
  const fromLink = params.get("task");

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- open the task a notification linked to
    if (fromLink) setOpenId(fromLink);
  }, [fromLink]);

  function close() {
    setOpenId(null);
    if (fromLink) router.replace("/dashboard", { scroll: false });
  }

  const list = tasks || [];
  const waiting = me ? list.filter((t) => needsMyAck(t, me.id)).length : 0;
  const open = list.find((t) => t._id === openId);

  return (
    <section className={`card overflow-hidden !p-0 ${waiting ? "task-flash-border" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-b border-line px-3 py-2">
        <h2 className="flex items-center gap-1.5 text-[0.8125rem] font-extrabold">
          <Zap className="h-3.5 w-3.5 text-accent" />Priority tasks
          {waiting > 0 && <span className="chip bg-danger text-white">{waiting} new</span>}
        </h2>
        <button className="btn-primary btn-sm" onClick={() => setCreating(true)}><Plus className="h-3.5 w-3.5" />Give a task</button>
      </div>
      <div className="p-1.5">
        {!tasks ? <p className="px-3 py-4 text-center text-xs text-muted">Loading…</p>
          : list.length === 0 ? <p className="px-3 py-4 text-center text-xs text-muted">No tasks. Use <b>Give a task</b> to hand quick work to anyone.</p>
          : list.map((t) => <TaskRow key={t._id} t={t} onOpen={() => setOpenId(t._id)} />)}
      </div>
      {creating && <NewTaskModal onClose={() => setCreating(false)} />}
      {open && <TaskModal task={open} onClose={close} onChange={(next) => mutate(list.map((t) => (t._id === next._id ? next : t)), { revalidate: false })} />}
    </section>
  );
}
