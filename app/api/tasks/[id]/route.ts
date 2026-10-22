import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Task not found.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await connectDB();
  const task = await db.collection("tasks").findOne({ _id: oid(id), ...notDeleted });
  if (!task) return bad("Task not found.", 404);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (b.title !== undefined) {
    if (!String(b.title).trim()) return bad("Task can't be empty.");
    set.title = String(b.title).trim();
  }
  if (b.assignees !== undefined) set.assignees = Array.isArray(b.assignees) ? [...new Set(b.assignees.filter(isId))].map(oid) : [];
  if (b.project !== undefined) set.project = isId(b.project) ? oid(b.project) : null;
  if (b.dueDate !== undefined) set.dueDate = b.dueDate || null;
  if (b.status !== undefined && b.status !== task.status) {
    set.status = b.status === "done" ? "done" : "open";
    set.doneAt = b.status === "done" ? new Date() : null;
    if (b.status === "done") await logActivity(db, s, "task.done", `completed “${task.title}”`, { project: task.project ?? undefined, task: task._id });
  }
  await db.collection("tasks").updateOne({ _id: task._id }, { $set: set });
  return NextResponse.json(await db.collection("tasks").findOne({ _id: task._id }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Task not found.", 404);
  const db = await connectDB();
  await db.collection("tasks").updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
