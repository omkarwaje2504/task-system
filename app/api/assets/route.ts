import { NextResponse } from "next/server";
import type { Document } from "mongodb";
import { connectDB, escapeRegex, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { cleanFiles } from "@/lib/assets";

/** Design library. ?type=<slug> &q=search */
export async function GET(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const params = new URL(req.url).searchParams;
  const db = await connectDB();
  const match: Document = { ...notDeleted };
  const slug = params.get("type");
  if (slug) {
    const t = await db.collection("productTypes").findOne({ slug, ...notDeleted });
    if (!t) return NextResponse.json([]);
    match.productType = t._id;
  }
  const q = (params.get("q") || "").trim();
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    match.$or = [{ title: rx }, { description: rx }, { tags: rx }];
  }
  const assets = await db.collection("assets").find(match).sort({ createdAt: -1 }).limit(500).toArray();
  return NextResponse.json(assets);
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  if (!isId(b.productType)) return bad("Pick which library this design belongs to.");
  const title = String(b.title || "").trim();
  if (!title) return bad("Give the theme a title.");
  const db = await connectDB();
  const type = await db.collection("productTypes").findOne({ _id: oid(b.productType), ...notDeleted });
  if (!type) return bad("That product type no longer exists.");
  const now = new Date();
  const doc = {
    productType: type._id,
    title,
    description: String(b.description || "").trim(),
    tags: Array.isArray(b.tags) ? b.tags.map((t: unknown) => String(t).trim()).filter(Boolean).slice(0, 10) : [],
    files: cleanFiles(b.files),
    createdBy: oid(s.id),
    createdByName: s.name,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection("assets").insertOne(doc);
  await logActivity(db, s, "asset.created", `added the ${type.name} design “${title}”`);
  return NextResponse.json({ _id: insertedId, ...doc });
}
