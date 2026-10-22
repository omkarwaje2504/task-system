import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";

/** Change your own password. */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { current, next } = await req.json().catch(() => ({}));
  if (!next || String(next).length < 6) return bad("New password must be at least 6 characters.");
  const db = await connectDB();
  const me = await db.collection("users").findOne({ _id: oid(s.id) });
  if (!me || !(await bcrypt.compare(String(current || ""), me.password))) return bad("Your current password is wrong.");
  await db.collection("users").updateOne({ _id: me._id }, { $set: { password: await bcrypt.hash(String(next), 10), updatedAt: new Date() } });
  return NextResponse.json({ ok: true });
}
