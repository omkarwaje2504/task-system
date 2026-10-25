import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveBrand, resolveCompany } from "@/lib/clients";
import { logActivity } from "@/lib/activity";
import { getProject } from "@/lib/projects";
import { cleanDepartments } from "@/lib/departments";
import { checklistFromTemplate, stepsFromTemplate, type ChecklistItem, type ChecklistTemplate, type StepTemplate } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const db = await connectDB();
  const p = await getProject(db, oid(id));
  return p ? NextResponse.json(p) : bad("Project not found.", 404);
}

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  const db = await connectDB();
  const existing = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!existing) return bad("Project not found.", 404);

  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (b.theme !== undefined) set.theme = String(b.theme).trim();
  if (b.notes !== undefined) set.notes = String(b.notes).trim();
  if (b.deadline !== undefined) set.deadline = b.deadline || null;
  if (b.departments !== undefined) set.departments = await cleanDepartments(db, b.departments);
  // ★ Priority: shared for the whole team; starred projects stay at the top of lists.
  if (typeof b.priority === "boolean" && b.priority !== !!existing.priority) {
    set.priority = b.priority;
    if (b.priority) await logActivity(db, s, "project.priority", "marked a project as priority", { project: existing._id });
  }
  // Changing the type keeps the steps; optionally adds the new type's template steps it doesn't have yet.
  if (b.productType !== undefined && String(b.productType) !== String(existing.productType)) {
    const type = isId(b.productType) ? await db.collection("productTypes").findOne({ _id: oid(b.productType), ...notDeleted }) : null;
    if (!type) return bad("That product type no longer exists.");
    set.productType = type._id;
    if (b.addTemplateSteps) {
      const have = new Set((existing.steps || []).map((st: { title: string }) => st.title.trim().toLowerCase()));
      const extra = stepsFromTemplate(((type.steps || []) as StepTemplate[]).filter((t) => !have.has(t.title.trim().toLowerCase())));
      set.steps = [...(existing.steps || []), ...extra];
    }
    // Ticks already made stay; the new type's checklist items the project doesn't have are added.
    const haveCheck = new Set((existing.checklist || []).map((c: ChecklistItem) => c.title.trim().toLowerCase()));
    const newChecks = (type.checklistOn ? (type.checklist || []) as ChecklistTemplate[] : []).filter((c) => !haveCheck.has(c.title.trim().toLowerCase()));
    if (newChecks.length) set.checklist = [...(existing.checklist || []), ...checklistFromTemplate(newChecks)];
    await logActivity(db, s, "project.type", `changed the type to ${type.name}`, { project: existing._id });
  }
  if (b.companyName !== undefined || b.brandName !== undefined) {
    const companyId = await resolveCompany(db, b.companyName);
    const { brand, company } = await resolveBrand(db, b.brandName, companyId);
    set.brand = brand;
    set.company = company;
  }
  if (b.status !== undefined && ["active", "completed", "on-hold"].includes(b.status) && b.status !== existing.status) {
    set.status = b.status;
    set.completedAt = b.status === "completed" ? new Date() : null;
    const verb = b.status === "completed" ? "closed" : b.status === "on-hold" ? "put on hold" : "re-opened";
    await logActivity(db, s, `project.${b.status}`, `${verb} a project`, { project: existing._id });
  }
  await db.collection("projects").updateOne({ _id: existing._id }, { $set: set });
  return NextResponse.json(await getProject(db, existing._id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const db = await connectDB();
  const existing = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted });
  if (!existing) return bad("Project not found.", 404);
  if (s.role !== "admin" && String(existing.createdBy) !== s.id) {
    return bad("Only whoever created this project (or an admin) can delete it.", 403);
  }
  await db.collection("projects").updateOne({ _id: existing._id }, { $set: { deleted: true, updatedAt: new Date() } });
  await logActivity(db, s, "project.deleted", "deleted a project", { project: existing._id });
  return NextResponse.json({ ok: true });
}
