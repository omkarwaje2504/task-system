import { NextResponse } from "next/server";
import { connectDB, isId, oid } from "@/lib/db";
import { bad, requireUser, type Session } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

type Ctx = { params: Promise<{ id: string }> };

// Anyone can add a shared credential; only whoever created it (or an admin)
// can edit or remove it.
const canManage = (s: Session, createdBy: unknown) => s.role === "admin" || String(createdBy) === s.id;

export async function PUT(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const db = await connectDB();
  const existing = await db.collection("credentials").findOne({ _id: oid(id) });
  if (!existing) return bad("Not found", 404);
  if (!canManage(s, existing.createdBy)) return bad("Only whoever added this (or an admin) can edit it.", 403);

  const b = await req.json().catch(() => ({}));
  if (b.service !== undefined && !String(b.service).trim()) return bad("Service is required.");
  if (b.cardLast4 && !/^\d{4}$/.test(b.cardLast4)) return bad("Card last 4 digits must be exactly 4 digits.");
  const set: Record<string, unknown> = { updatedAt: new Date() };
  if (b.service !== undefined) set.service = String(b.service).trim();
  if (b.name !== undefined) set.name = String(b.name).trim();
  if (b.username !== undefined) set.username = b.username;
  if (b.notes !== undefined) set.notes = b.notes;
  if (b.password) set.encryptedPassword = encrypt(b.password); // blank = keep current
  if (b.billingStatus !== undefined) set.billingStatus = b.billingStatus === "suspended" ? "suspended" : "active";
  if (b.billingAmount !== undefined) set.billingAmount = b.billingAmount;
  if (b.nextPaymentDate !== undefined) set.nextPaymentDate = b.nextPaymentDate || null;
  if (b.cardLast4 !== undefined) set.cardLast4 = b.cardLast4;
  await db.collection("credentials").updateOne({ _id: oid(id) }, { $set: set });
  const doc = await db.collection("credentials").findOne({ _id: oid(id) }, { projection: { encryptedPassword: 0, accessLog: 0 } });
  return NextResponse.json(doc);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const db = await connectDB();
  const existing = await db.collection("credentials").findOne({ _id: oid(id) });
  if (!existing) return bad("Not found", 404);
  if (!canManage(s, existing.createdBy)) return bad("Only whoever added this (or an admin) can delete it.", 403);
  await db.collection("credentials").updateOne({ _id: oid(id) }, { $set: { deleted: true, updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
