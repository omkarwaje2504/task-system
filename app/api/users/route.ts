import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB, notDeleted } from "@/lib/db";
import { bad, requireAdmin, requireUser } from "@/lib/auth";

const PUBLIC = { password: 0, appearance: 0 };

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const users = await db.collection("users").find(notDeleted, { projection: PUBLIC }).sort({ name: 1 }).toArray();
  return NextResponse.json(users);
}

/** Only admins create accounts — there is no public sign-up. */
export async function POST(req: Request) {
  const s = await requireAdmin();
  if (s instanceof NextResponse) return s;
  const { name, email, mobile, password, role, team } = await req.json().catch(() => ({}));
  if (!name?.trim()) return bad("Name is required.");
  if (!email?.trim()) return bad("Email is required.");
  if (!password || String(password).length < 6) return bad("Password must be at least 6 characters.");
  const db = await connectDB();
  const cleanEmail = String(email).trim().toLowerCase();
  if (await db.collection("users").findOne({ email: cleanEmail, ...notDeleted })) {
    return bad("Someone already uses this email.");
  }
  const now = new Date();
  const doc = {
    name: name.trim(),
    email: cleanEmail,
    mobile: (mobile || "").trim(),
    password: await bcrypt.hash(String(password), 10),
    role: role === "admin" ? "admin" : "member",
    team: (team || "").trim(),
    active: true,
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const { insertedId } = await db.collection("users").insertOne(doc);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { password: _pw, ...safe } = doc;
  return NextResponse.json({ _id: insertedId, ...safe });
}
