import { NextResponse } from "next/server";
import { connectDB, escapeRegex, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireAdmin } from "@/lib/auth";
import { STEP_KINDS, uid, type StepTemplate } from "@/lib/workflow";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireAdmin();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const body = await req.json().catch(() => ({}));
  const db = await connectDB();
  const set: Record<string, unknown> = { updatedAt: new Date() };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) return bad("Name is required.");
    const clash = await db.collection("productTypes").findOne({
      _id: { $ne: oid(id) }, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" }, ...notDeleted,
    });
    if (clash) return bad("Another product type already has this name.");
    set.name = name;
  }
  if (body.icon !== undefined) set.icon = String(body.icon);
  if (body.special !== undefined) set.special = !!body.special;
  if (body.assetTab !== undefined) set.assetTab = !!body.assetTab;
  if (body.order !== undefined) set.order = Number(body.order) || 0;
  if (Array.isArray(body.assetSlots)) {
    set.assetSlots = body.assetSlots.map((x: unknown) => String(x).trim()).filter(Boolean).slice(0, 8);
  }
  if (Array.isArray(body.steps)) {
    set.steps = body.steps
      .filter((st: StepTemplate) => st && String(st.title || "").trim())
      .map((st: StepTemplate): StepTemplate => ({
        id: st.id || uid(),
        title: String(st.title).trim(),
        hint: String(st.hint || "").trim(),
        kind: st.kind in STEP_KINDS ? st.kind : "check",
      }));
  }
  await db.collection("productTypes").updateOne({ _id: oid(id) }, { $set: set });
  return NextResponse.json(await db.collection("productTypes").findOne({ _id: oid(id) }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireAdmin();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const db = await connectDB();
  const inUse = await db.collection("projects").countDocuments({ productType: oid(id), ...notDeleted });
  if (inUse) return bad(`${inUse} project(s) still use this type. Move them first.`);
  await db.collection("productTypes").updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
