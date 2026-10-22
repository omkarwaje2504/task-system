import { NextResponse } from "next/server";
import { connectDB, isId, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { PRINTER_FIELDS } from "@/lib/printers";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email_id = String(body.email_id || "").trim();
  if (!name) return bad("Name is required.");
  if (!email_id) return bad("Email is required.");
  const set: Record<string, unknown> = { name, email_id, updatedAt: new Date() };
  for (const f of PRINTER_FIELDS) set[f] = String(body[f] || "").trim();
  const db = await connectDB();
  await db.collection("printers").updateOne({ _id: oid(id) }, { $set: set });
  return NextResponse.json(await db.collection("printers").findOne({ _id: oid(id) }));
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const db = await connectDB();
  await db.collection("printers").updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
