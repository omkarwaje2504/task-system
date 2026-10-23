import { NextResponse } from "next/server";
import { connectDB, isId, oid } from "@/lib/db";
import { requireUser } from "@/lib/auth";

/** The signed-in person's latest notifications and how many are unread. */
export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const me = oid(s.id);
  const [items, unread] = await Promise.all([
    db.collection("notifications").find({ user: me }).sort({ createdAt: -1 }).limit(50).toArray(),
    db.collection("notifications").countDocuments({ user: me, read: false }),
  ]);
  return NextResponse.json({ items, unread, push: !!process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY });
}

/** Mark read: { ids: [...] } — or everything when no ids are given. */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { ids } = await req.json().catch(() => ({}));
  const db = await connectDB();
  const filter = Array.isArray(ids) ? { _id: { $in: ids.filter(isId).map(oid) } } : {};
  await db.collection("notifications").updateMany({ user: oid(s.id), read: false, ...filter }, { $set: { read: true, readAt: new Date() } });
  return NextResponse.json({ ok: true });
}
