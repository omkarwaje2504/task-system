import { NextResponse } from "next/server";
import { connectDB, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";

const MAX_DEVICES = 10;
const clean = (t: unknown) => (typeof t === "string" && /^[\w:.-]{20,4096}$/.test(t) ? t : null);

/** This device's FCM token, so pushes reach it: { token } */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const token = clean((await req.json().catch(() => ({}))).token);
  if (!token) return bad("That doesn't look like a push token.");
  const db = await connectDB();
  const u = await db.collection("users").findOne({ _id: oid(s.id) }, { projection: { fcmTokens: 1 } });
  // Newest last; keep the most recent few devices.
  const tokens = [...((u?.fcmTokens as string[]) || []).filter((t) => t !== token), token].slice(-MAX_DEVICES);
  await db.collection("users").updateOne({ _id: oid(s.id) }, { $set: { fcmTokens: tokens } });
  return NextResponse.json({ ok: true, devices: tokens.length });
}

/** Turn push off on this device: { token } */
export async function DELETE(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const token = clean((await req.json().catch(() => ({}))).token);
  const db = await connectDB();
  if (token) await db.collection("users").updateOne({ _id: oid(s.id) }, { $pull: { fcmTokens: token } as never });
  return NextResponse.json({ ok: true });
}
