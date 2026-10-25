import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { getProject } from "@/lib/projects";
import { checklistFromTemplate, type ChecklistItem, type ChecklistTemplate } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string }> };

/** Tick / untick one checklist item: { itemId, done }. */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await connectDB();
  const project = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!project) return bad("Project not found.", 404);
  const item = ((project.checklist || []) as ChecklistItem[]).find((c) => c.id === b.itemId);
  if (!item) return bad("Checklist item not found — refresh the page.", 404);

  const done = !!b.done;
  if (done !== item.done) {
    const now = new Date();
    await db.collection("projects").updateOne(
      { _id: project._id, "checklist.id": item.id },
      { $set: { "checklist.$.done": done, "checklist.$.doneAt": done ? now : null, "checklist.$.doneByName": done ? s.name : null, updatedAt: now } },
    );
    await logActivity(db, s, done ? "checklist.done" : "checklist.undone", `${done ? "ticked" : "unticked"} “${item.title}”`, { project: project._id });
  }
  return NextResponse.json(await getProject(db, project._id));
}

/** Projects made before their type had a checklist: copy in the type's items they're missing. */
export async function POST(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const db = await connectDB();
  const project = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!project) return bad("Project not found.", 404);
  const type = await db.collection("productTypes").findOne({ _id: project.productType });
  const current = (project.checklist || []) as ChecklistItem[];
  const have = new Set(current.map((c) => c.title.trim().toLowerCase()));
  if (!type?.checklistOn) return bad(`The ${type?.name || "product type"} checklist is switched off.`);
  const missing = ((type.checklist || []) as ChecklistTemplate[]).filter((c) => !have.has(c.title.trim().toLowerCase()));
  if (missing.length) {
    await db.collection("projects").updateOne(
      { _id: project._id },
      { $set: { checklist: [...current, ...checklistFromTemplate(missing)], updatedAt: new Date() } },
    );
  }
  return NextResponse.json(await getProject(db, project._id));
}
