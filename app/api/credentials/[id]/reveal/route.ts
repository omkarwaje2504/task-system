import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB, isId, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { decrypt } from "@/lib/crypto";

type Ctx = { params: Promise<{ id: string }> };
const MAX_LOG_ENTRIES = 20;

/**
 * Reveals one credential's password — only after the viewer re-enters
 * their *own* login password (step-up check, like GitHub's sudo mode).
 */
export async function POST(req: Request, { params }: Ctx) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const { id } = await params;
  if (!isId(id)) return bad("Not found", 404);
  const { password } = await req.json().catch(() => ({}));
  if (!password) return bad("Enter your login password.");

  const db = await connectDB();
  const me = await db.collection("users").findOne({ _id: oid(s.id) });
  if (!me || !(await bcrypt.compare(String(password), me.password))) return bad("That is not your login password.", 403);

  const cred = await db.collection("credentials").findOne({ _id: oid(id), ...notDeleted });
  if (!cred) return bad("Not found", 404);

  let plaintext: string;
  try {
    plaintext = decrypt(cred.encryptedPassword);
  } catch {
    return bad("Could not decrypt this credential — CREDENTIALS_SECRET may have changed.", 500);
  }

  const now = new Date();
  const accessLog = [...(cred.accessLog || []), { by: oid(s.id), byName: s.name, at: now }].slice(-MAX_LOG_ENTRIES);
  await db.collection("credentials").updateOne({ _id: cred._id }, {
    $set: { lastAccessedBy: oid(s.id), lastAccessedByName: s.name, lastAccessedAt: now, accessLog },
  });
  return NextResponse.json({ password: plaintext, username: cred.username });
}
