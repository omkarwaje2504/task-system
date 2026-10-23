import { NextResponse } from "next/server";
import { connectDB, oid } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { cleanAppearance } from "@/lib/appearance";

/** The signed-in person's own appearance settings (Settings → Appearance). */
export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const u = await db.collection("users").findOne({ _id: oid(s.id) }, { projection: { appearance: 1 } });
  return NextResponse.json(cleanAppearance(u?.appearance));
}

export async function PUT(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const appearance = cleanAppearance(await req.json().catch(() => ({})));
  const db = await connectDB();
  await db.collection("users").updateOne({ _id: oid(s.id) }, { $set: { appearance, updatedAt: new Date() } });
  return NextResponse.json(appearance);
}
