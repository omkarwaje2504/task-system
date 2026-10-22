import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { refreshTotals } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string }> };

/** Daily count log for a "quantity" step (RxPad-style). ?step=<stepId> */
export async function GET(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const stepId = new URL(req.url).searchParams.get("step") || "";
  const db = await connectDB();
  const logs = await db.collection("progress")
    .find({ project: oid(id), stepId, ...notDeleted })
    .sort({ date: -1, createdAt: -1 })
    .toArray();
  return NextResponse.json(logs);
}

export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  if (!b.stepId) return bad("stepId is required.");
  const added = Math.max(0, Number(b.added) || 0);
  const completed = Math.max(0, Number(b.completed) || 0);
  const declined = Math.max(0, Number(b.declined) || 0);
  if (!added && !completed && !declined) return bad("Enter at least one number.");
  const db = await connectDB();
  const project = await db.collection("projects").findOne({ _id: oid(id), "steps.id": b.stepId, ...notDeleted });
  if (!project) return bad("Step not found — refresh the page.", 404);
  await db.collection("progress").insertOne({
    project: project._id,
    stepId: b.stepId,
    date: /^\d{4}-\d{2}-\d{2}$/.test(b.date) ? b.date : new Date().toISOString().slice(0, 10),
    added, completed, declined,
    note: String(b.note || "").trim(),
    user: oid(s.id),
    userName: s.name,
    deleted: false,
    createdAt: new Date(),
  });
  const totals = await refreshTotals(db, project._id, b.stepId);
  return NextResponse.json({ totals });
}
