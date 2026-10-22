import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { cleanFiles } from "@/lib/assets";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Design not found.", 404);
  const b = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (b.title !== undefined) {
    if (!String(b.title).trim()) return bad("Give the theme a title.");
    set.title = String(b.title).trim();
  }
  if (b.description !== undefined) set.description = String(b.description).trim();
  if (b.tags !== undefined) set.tags = Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 10) : [];
  if (b.files !== undefined) set.files = cleanFiles(b.files);
  const db = await connectDB();
  const res = await db.collection("assets").updateOne({ _id: oid(id), ...notDeleted }, { $set: set });
  if (!res.matchedCount) return bad("Design not found.", 404);
  return NextResponse.json(await db.collection("assets").findOne({ _id: oid(id) }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Design not found.", 404);
  const db = await connectDB();
  const asset = await db.collection("assets").findOne({ _id: oid(id) });
  if (!asset) return bad("Design not found.", 404);
  if (s.role !== "admin" && String(asset.createdBy) !== s.id) return bad("Only whoever added this design (or an admin) can delete it.", 403);
  await db.collection("assets").updateOne({ _id: asset._id }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
