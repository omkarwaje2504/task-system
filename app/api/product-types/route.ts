import { NextResponse } from "next/server";
import { connectDB, escapeRegex, notDeleted, slugify } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const types = await db.collection("productTypes").find(notDeleted).sort({ special: -1, order: 1, name: 1 }).toArray();
  return NextResponse.json(types);
}

/** Anyone can add a plain product type; flags and templates are admin-only (PUT). */
export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { name } = await req.json().catch(() => ({}));
  const clean = String(name || "").trim();
  if (!clean) return bad("Name is required.");
  const db = await connectDB();
  const existing = await db.collection("productTypes").findOne({ name: { $regex: `^${escapeRegex(clean)}$`, $options: "i" }, ...notDeleted });
  if (existing) return NextResponse.json(existing);
  let slug = slugify(clean) || "type";
  if (await db.collection("productTypes").findOne({ slug })) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;
  const count = await db.collection("productTypes").countDocuments();
  const now = new Date();
  const doc = {
    name: clean, slug, icon: "box", special: false, assetTab: false,
    assetSlots: ["Cover", "Front", "Back"], steps: [], order: count, deleted: false, createdAt: now, updatedAt: now,
  };
  const { insertedId } = await db.collection("productTypes").insertOne(doc);
  return NextResponse.json({ _id: insertedId, ...doc });
}
