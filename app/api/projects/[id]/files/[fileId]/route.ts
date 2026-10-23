import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, forbidden, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";

type Ctx = { params: Promise<{ id: string; fileId: string }> };

/** { final?: boolean, title?: string (empty clears it), name?: string } */
export async function PATCH(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id, fileId } = await params;
  if (!isId(id) || !isId(fileId)) return bad("File not found.", 404);
  const b = await req.json().catch(() => ({}));
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (typeof b.final === "boolean") set.final = b.final;
  if (typeof b.name === "string" && b.name.trim()) set.name = b.name.trim().slice(0, 200);
  if (typeof b.title === "string") set.title = b.title.trim().slice(0, 200);
  const db = await connectDB();
  const file = await db.collection("projectFiles").findOneAndUpdate(
    { _id: oid(fileId), project: oid(id), ...notDeleted },
    { $set: set },
    { returnDocument: "after" },
  );
  if (!file) return bad("File not found.", 404);
  if (set.final === true) await logActivity(db, s, "file.final", `marked “${file.title || file.name}” as final artwork`, { project: id });
  return NextResponse.json(file);
}

/** Hides the file for everyone (the uploader or an admin). */
export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id, fileId } = await params;
  if (!isId(id) || !isId(fileId)) return bad("File not found.", 404);
  const db = await connectDB();
  const file = await db.collection("projectFiles").findOne({ _id: oid(fileId), project: oid(id), ...notDeleted });
  if (!file) return bad("File not found.", 404);
  if (s.role !== "admin" && String(file.createdBy) !== s.id) return forbidden("Only the person who added this file, or an admin, can remove it.");
  await db.collection("projectFiles").updateOne({ _id: file._id }, { $set: { deleted: true, updatedAt: new Date() } });
  await logActivity(db, s, "file.removed", `removed “${file.title || file.name}”`, { project: id });
  return NextResponse.json({ ok: true });
}
