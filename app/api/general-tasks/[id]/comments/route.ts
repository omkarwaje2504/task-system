import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { uid } from "@/lib/workflow";
import { cleanTaskFiles } from "@/lib/generalTasksServer";

type Ctx = { params: Promise<{ id: string }> };

/** { text, files } — adds a comment; everyone else on the task is notified. */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Task not found.", 404);
  const b = await req.json().catch(() => ({}));
  const text = String(b.text || "").trim().slice(0, 4000);
  const files = cleanTaskFiles(b.files);
  if (!text && !files.length) return bad("Write a comment or attach a file.");

  const db = await connectDB();
  const t = await db.collection("generalTasks").findOne({ _id: oid(id), ...notDeleted });
  if (!t) return bad("Task not found.", 404);
  const now = new Date();
  const comment = { id: uid(), user: s.id, userName: s.name, text, files, createdAt: now };
  await db.collection("generalTasks").updateOne({ _id: t._id }, { $push: { comments: comment } as never, $set: { updatedAt: now } });
  await notify(db, s, [t.createdBy, ...t.assignees], {
    type: "task.comment", title: `${s.name} commented on a task`,
    body: text ? text.slice(0, 160) : `${files.length} attachment${files.length === 1 ? "" : "s"}`,
    link: `/dashboard?task=${t._id}`,
  });
  return NextResponse.json(await db.collection("generalTasks").findOne({ _id: t._id }));
}

/** ?commentId= — whoever wrote it (or an admin) can remove a comment. */
export async function DELETE(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  const commentId = new URL(req.url).searchParams.get("commentId") || "";
  if (!isId(id) || !commentId) return bad("Comment not found.", 404);
  const db = await connectDB();
  const mine = s.role === "admin" ? {} : { user: s.id };
  await db.collection("generalTasks").updateOne({ _id: oid(id) }, { $pull: { comments: { id: commentId, ...mine } } as never });
  return NextResponse.json(await db.collection("generalTasks").findOne({ _id: oid(id) }));
}
