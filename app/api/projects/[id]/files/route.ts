import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { R2_PUBLIC_URL } from "@/lib/r2";
import { fileKind } from "@/lib/files";

type Ctx = { params: Promise<{ id: string }> };

/** Only URLs from our own bucket (what /api/upload/presign hands out). */
const ours = (v: unknown) => typeof v === "string" && v.startsWith(`${R2_PUBLIC_URL()}/new-system/`) && v.length < 1000;

export async function GET(_req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const db = await connectDB();
  const files = await db.collection("projectFiles")
    .find({ project: oid(id), ...notDeleted })
    .sort({ final: -1, createdAt: -1 })
    .toArray();
  return NextResponse.json(files);
}

/** Records files the browser already uploaded to R2 (with an optional thumbnail). */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Project not found.", 404);
  const b = await req.json().catch(() => ({}));
  if (!ours(b.url)) return bad("Upload the file first.");
  const name = String(b.name || "file").trim().slice(0, 200);
  const title = String(b.title || "").trim().slice(0, 200);
  const mime = String(b.mime || "").slice(0, 120);
  const db = await connectDB();
  const project = await db.collection("projects").findOne({ _id: oid(id), ...notDeleted }, { projection: { _id: 1 } });
  if (!project) return bad("Project not found.", 404);

  const doc = {
    project: project._id,
    title,
    name,
    url: b.url as string,
    mime,
    size: Math.max(0, Number(b.size) || 0),
    kind: fileKind(name, mime),
    thumb: ours(b.thumb) ? (b.thumb as string) : null,
    final: !!b.final,
    createdBy: oid(s.id),
    createdByName: s.name,
    deleted: false,
    createdAt: new Date(),
  };
  const { insertedId } = await db.collection("projectFiles").insertOne(doc);
  await db.collection("projects").updateOne({ _id: project._id }, { $set: { updatedAt: new Date() } });
  await logActivity(db, s, "file.added", `added ${doc.final ? "final artwork" : "a file"} “${title || name}”`, { project: project._id });
  return NextResponse.json({ _id: insertedId, ...doc });
}
