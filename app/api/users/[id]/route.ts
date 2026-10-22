import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, forgetUser, requireAdmin } from "@/lib/auth";

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
    if (!body.name.trim()) return bad("Name is required.");
    set.name = body.name.trim();
  }
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase();
    if (!email) return bad("Email is required.");
    if (await db.collection("users").findOne({ email, _id: { $ne: oid(id) }, ...notDeleted })) return bad("Someone already uses this email.");
    set.email = email;
  }
  if (body.mobile !== undefined) set.mobile = String(body.mobile).trim();
  if (body.team !== undefined) set.team = String(body.team).trim();
  if (body.role !== undefined) {
    if (id === s.id && body.role !== "admin") return bad("You can't remove your own admin access.");
    set.role = body.role === "admin" ? "admin" : "member";
  }
  if (body.active !== undefined) {
    if (id === s.id && !body.active) return bad("You can't switch off your own account.");
    set.active = !!body.active;
  }
  if (body.password) {
    if (String(body.password).length < 6) return bad("Password must be at least 6 characters.");
    set.password = await bcrypt.hash(String(body.password), 10);
  }
  await db.collection("users").updateOne({ _id: oid(id) }, { $set: set });
  forgetUser(id);
  const user = await db.collection("users").findOne({ _id: oid(id) }, { projection: { password: 0 } });
  return NextResponse.json(user);
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const s = await requireAdmin();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  if (id === s.id) return bad("You can't delete your own account.");
  const db = await connectDB();
  await db.collection("users").updateOne({ _id: oid(id) }, { $set: { deleted: true, active: false, updatedAt: new Date() } });
  forgetUser(id);
  return NextResponse.json({ ok: true });
}
