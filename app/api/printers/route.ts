import { NextResponse } from "next/server";
import { connectDB, escapeRegex, notDeleted } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { PRINTER_FIELDS } from "@/lib/printers";

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  return NextResponse.json(await db.collection("printers").find(notDeleted).sort({ name: 1 }).toArray());
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const body = await req.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email_id = String(body.email_id || "").trim();
  if (!name) return bad("Name is required.");
  if (!email_id) return bad("Email is required.");
  const db = await connectDB();
  // Typing an existing name+email just returns it instead of duplicating.
  const existing = await db.collection("printers").findOne({
    ...notDeleted, email_id, name: { $regex: `^${escapeRegex(name)}$`, $options: "i" },
  });
  if (existing) return NextResponse.json(existing);
  const now = new Date();
  const doc: Record<string, unknown> = { name, email_id, deleted: false, createdAt: now, updatedAt: now, createdBy: s.id };
  for (const f of PRINTER_FIELDS) doc[f] = String(body[f] || "").trim();
  const { insertedId } = await db.collection("printers").insertOne(doc);
  return NextResponse.json({ _id: insertedId, ...doc });
}
