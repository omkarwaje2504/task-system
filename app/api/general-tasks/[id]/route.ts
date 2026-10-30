import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser, type Session } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { cleanTaskFiles } from "@/lib/generalTasksServer";

type Ctx = { params: Promise<{ id: string }> };

async function findTask(id: string) {
  if (!isId(id)) return null;
  const db = await connectDB();
  const t = await db.collection("generalTasks").findOne({ _id: oid(id), ...notDeleted });
  return t ? { db, t } : null;
}

const canManage = (s: Session, t: Document) => s.role === "admin" || t.createdBy === s.id;

/**
 * { ack: true } — "I've seen it" (assignees)
 * { done: boolean } — finish / reopen (assignees, whoever gave it, admins)
 * { text?, assignees?, files? } — edit (whoever gave it, admins)
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await findTask((await params).id);
  if (!found) return bad("Task not found.", 404);
  const { db, t } = found;
  const b = await req.json().catch(() => ({}));
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };
  const onIt = (t.assignees as string[]).includes(s.id);
  const link = `/dashboard?task=${t._id}`;
  const others = [t.createdBy, ...t.assignees] as string[];

  if (b.ack === true) {
    if (!onIt) return bad("Only people on this task can acknowledge it.", 403);
    if (!(t.acks || []).some((a: { user: string }) => a.user === s.id)) {
      set.acks = [...(t.acks || []), { user: s.id, at: now }];
      await notify(db, s, [t.createdBy], { type: "task.ack", title: `${s.name} saw your task`, body: String(t.text).slice(0, 160), link });
    }
  }

  if (typeof b.done === "boolean" && b.done !== !!t.done) {
    if (!onIt && !canManage(s, t)) return bad("Only people on this task can finish it.", 403);
    set.done = b.done;
    set.doneAt = b.done ? now : null;
    set.doneByName = b.done ? s.name : null;
    if (b.done) {
      await logActivity(db, s, "task.done", `finished a task: “${String(t.text).slice(0, 60)}”`);
      await notify(db, s, others, { type: "task.done", title: `${s.name} finished a task`, body: String(t.text).slice(0, 160), link });
    }
  }

  if (b.text !== undefined || b.assignees !== undefined || b.files !== undefined) {
    if (!canManage(s, t)) return bad("Only whoever gave this task (or an admin) can change it.", 403);
    if (b.text !== undefined) {
      const text = String(b.text).trim().slice(0, 4000);
      if (!text) return bad("Write what the task is.");
      set.text = text;
    }
    if (b.files !== undefined) set.files = cleanTaskFiles(b.files);
    if (b.assignees !== undefined) {
      const assignees = Array.isArray(b.assignees) ? [...new Set<string>(b.assignees.filter(isId))] : [];
      if (!assignees.length) return bad("Pick at least one person.");
      set.assignees = assignees;
      set.acks = (t.acks || []).filter((a: { user: string }) => assignees.includes(a.user));
      const added = assignees.filter((a) => !(t.assignees as string[]).includes(a));
      if (added.length) {
        await notify(db, s, added, { type: "task.assigned", title: `🔔 ${s.name} gave you a general task`, body: String(set.text || t.text).slice(0, 160), link, tag: `task-${t._id}` });
      }
    }
  }

  await db.collection("generalTasks").updateOne({ _id: t._id }, { $set: set });
  return NextResponse.json(await db.collection("generalTasks").findOne({ _id: t._id }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await findTask((await params).id);
  if (!found) return bad("Task not found.", 404);
  const { db, t } = found;
  if (!canManage(s, t)) return bad("Only whoever gave this task (or an admin) can delete it.", 403);
  await db.collection("generalTasks").updateOne({ _id: t._id }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
