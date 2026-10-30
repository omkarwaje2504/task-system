import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { notify } from "@/lib/notify";
import { cleanTaskFiles } from "@/lib/generalTasksServer";

/**
 * General tasks I'm on or gave out. ?all=1 (admins): everyone's.
 * Open ones first; finished ones from the last 7 days after them.
 */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const all = s.role === "admin" && new URL(req.url).searchParams.get("all") === "1";
  const db = await connectDB();
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const tasks = await db.collection("generalTasks").find({
    ...notDeleted,
    ...(all ? {} : { $or: [{ assignees: s.id }, { createdBy: s.id }] }),
    $and: [{ $or: [{ done: { $ne: true } }, { doneAt: { $gte: weekAgo } }] }],
  }).sort({ done: 1, createdAt: -1 }).limit(100).toArray();
  return NextResponse.json(tasks);
}

/** { text, assignees: [ids], files: [{name,url,mime,size}] } */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 4000);
  if (!text) return bad("Write what the task is.");
  const assignees = Array.isArray(b.assignees) ? [...new Set<string>(b.assignees.filter(isId))] : [];
  if (!assignees.length) return bad("Pick at least one person.");

  const db = await connectDB();
  const now = new Date();
  const doc = {
    text, files: cleanTaskFiles(b.files), assignees, acks: [], comments: [],
    done: false, doneAt: null, doneByName: null,
    createdBy: s.id, createdByName: s.name, deleted: false, createdAt: now, updatedAt: now,
  };
  const { insertedId } = await db.collection("generalTasks").insertOne(doc);
  await logActivity(db, s, "task.created", `gave a task to ${assignees.length} ${assignees.length === 1 ? "person" : "people"}`);
  await notify(db, s, assignees, {
    type: "task.assigned", title: `🔔 ${s.name} gave you a priority task`, body: text.slice(0, 160),
    link: `/dashboard?task=${insertedId}`, tag: `task-${insertedId}`,
  });
  return NextResponse.json({ _id: insertedId, ...doc });
}
