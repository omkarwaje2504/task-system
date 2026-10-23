import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { resolveBrand, resolveCompany } from "@/lib/clients";
import { logActivity } from "@/lib/activity";
import { getProject } from "@/lib/projects";
import { PICKABLE, SAMPLE_STATUS, type SampleStatus } from "@/lib/samples";

type Ctx = { params: Promise<{ id: string }> };

async function findSample(id: string) {
  if (!isId(id)) return null;
  const db = await connectDB();
  const p = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted, sampleStatus: { $exists: true } });
  return p ? { db, p } : null;
}

export async function GET(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await findSample((await params).id);
  if (!found) return bad("Sample not found.", 404);
  return NextResponse.json(await getProject(found.db, found.p._id));
}

/**
 * { working?: boolean }  — "I'm working": adds / removes you, and moves a requested sample to Working
 * { sampleStatus?, theme?, notes?, productType?, companyName?, brandName?, priority? }
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await findSample((await params).id);
  if (!found) return bad("Sample not found.", 404);
  const { db, p } = found;
  if (!p.sample) return bad("This sample already became a project.", 409);
  const b = await req.json().catch(() => ({}));
  const now = new Date();
  const set: Record<string, unknown> = { updatedAt: now };

  if (typeof b.working === "boolean") {
    const workers: string[] = p.workers || [];
    set.workers = b.working ? [...new Set([...workers, s.id])] : workers.filter((w) => w !== s.id);
    if (b.working) {
      set.workingSince = now;
      if (p.sampleStatus === "requested") set.sampleStatus = "working";
      await logActivity(db, s, "sample.working", "started working on a sample", { project: p._id });
    }
  }
  if (b.sampleStatus !== undefined && PICKABLE.includes(b.sampleStatus) && b.sampleStatus !== p.sampleStatus) {
    set.sampleStatus = b.sampleStatus as SampleStatus;
    await logActivity(db, s, "sample.status", `moved a sample to “${SAMPLE_STATUS[b.sampleStatus as SampleStatus].label}”`, { project: p._id });
  }
  if (b.theme !== undefined) set.theme = String(b.theme).trim();
  if (b.notes !== undefined) set.notes = String(b.notes).trim();
  if (typeof b.priority === "boolean") set.priority = b.priority;
  if (b.productType !== undefined) {
    const type = isId(b.productType) ? await db.collection("productTypes").findOne({ _id: oid(b.productType), ...notDeleted }) : null;
    if (!type) return bad("That product type no longer exists.");
    set.productType = type._id;
  }
  if (b.companyName !== undefined || b.brandName !== undefined) {
    const companyId = await resolveCompany(db, b.companyName);
    const { brand, company } = await resolveBrand(db, b.brandName, companyId);
    set.brand = brand;
    set.company = company;
  }
  await db.collection("projects").updateOne({ _id: p._id }, { $set: set });
  return NextResponse.json(await getProject(db, p._id));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const found = await findSample((await params).id);
  if (!found) return bad("Sample not found.", 404);
  const { db, p } = found;
  if (!p.sample) return bad("This sample already became a project — delete the project instead.", 409);
  if (s.role !== "admin" && String(p.createdBy) !== s.id) return bad("Only whoever added this sample (or an admin) can delete it.", 403);
  await db.collection("projects").updateOne({ _id: p._id }, { $set: { deleted: true, updatedAt: new Date() } });
  await logActivity(db, s, "sample.deleted", "deleted a sample", { project: p._id });
  return NextResponse.json({ ok: true });
}
