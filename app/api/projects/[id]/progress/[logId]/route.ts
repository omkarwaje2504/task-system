import { NextResponse } from "next/server";
import { connectDB, isId, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { refreshTotals } from "@/lib/projects";

type Ctx = { params: Promise<{ id: string; logId: string }> };

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id, logId } = await params;
  if (!isId(id) || !isId(logId)) return bad("Not found", 404);
  const db = await connectDB();
  const log = await db.collection("progress").findOne({ _id: oid(logId), project: oid(id) });
  if (!log) return bad("Not found", 404);
  if (s.role !== "admin" && String(log.user) !== s.id) return bad("Only whoever added this entry (or an admin) can remove it.", 403);
  await db.collection("progress").updateOne({ _id: log._id }, { $set: { deleted: true } });
  const totals = await refreshTotals(db, log.project, log.stepId);
  return NextResponse.json({ totals });
}
