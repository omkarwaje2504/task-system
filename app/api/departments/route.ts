import { NextResponse } from "next/server";
import { connectDB, escapeRegex, notDeleted } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { listDepartments } from "@/lib/departments";

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  return NextResponse.json(await listDepartments(db));
}

/** Anyone can add a department (like product types); an existing name returns the existing one. */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { name } = await req.json().catch(() => ({}));
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return bad("Name is required.");
  const db = await connectDB();
  const col = db.collection("departments");
  const existing = await col.findOne({ name: { $regex: `^${escapeRegex(clean)}$`, $options: "i" }, ...notDeleted });
  if (existing) return NextResponse.json(existing);
  const now = new Date();
  const doc = { name: clean, order: await col.countDocuments(), deleted: false, createdAt: now, updatedAt: now };
  const { insertedId } = await col.insertOne(doc);
  return NextResponse.json({ _id: insertedId, ...doc });
}
