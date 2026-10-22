import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { getProject } from "@/lib/projects";
import { STEP_KINDS, stepsFromTemplate, type StepKind } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string }> };

/** Add an extra step to one project (doesn't change the product type's template). */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  const title = String(b.title || "").trim();
  if (!title) return bad("Give the step a name.");
  const kind: StepKind = b.kind in STEP_KINDS ? b.kind : "check";
  const [step] = stepsFromTemplate([{ id: "", title, kind, hint: String(b.hint || "").trim() }]);
  const db = await connectDB();
  const res = await db.collection("projects").updateOne(
    { _id: oid(id), ...notDeleted },
    { $push: { steps: step } as never, $set: { updatedAt: new Date() } },
  );
  if (!res.matchedCount) return bad("Project not found.", 404);
  return NextResponse.json(await getProject(db, oid(id)));
}

/** Reorder steps: { order: [stepId, ...] } */
export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const { order } = await req.json().catch(() => ({}));
  if (!Array.isArray(order)) return bad("order is required.");
  const db = await connectDB();
  const p = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!p) return bad("Project not found.", 404);
  const byId = new Map((p.steps || []).map((st: { id: string }) => [st.id, st]));
  const steps = order.map((sid: string) => byId.get(sid)).filter(Boolean);
  if (steps.length !== byId.size) return bad("Step list is out of date — refresh and try again.", 409);
  await db.collection("projects").updateOne({ _id: p._id }, { $set: { steps, updatedAt: new Date() } });
  return NextResponse.json(await getProject(db, p._id));
}
