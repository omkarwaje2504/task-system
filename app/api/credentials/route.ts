import { NextResponse } from "next/server";
import { connectDB, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { encrypt } from "@/lib/crypto";

// The encrypted password blob never leaves the server in list responses —
// only /reveal returns it, after the viewer re-enters their own password.
const LIST_FIELDS = {
  service: 1, name: 1, username: 1, notes: 1, createdBy: 1, createdByName: 1,
  createdAt: 1, updatedAt: 1, lastAccessedByName: 1, lastAccessedAt: 1,
  billingStatus: 1, billingAmount: 1, nextPaymentDate: 1, cardLast4: 1,
};

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const creds = await db.collection("credentials").find(notDeleted, { projection: LIST_FIELDS }).sort({ createdAt: -1 }).toArray();
  return NextResponse.json(creds);
}

export async function POST(req: Request) {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const b = await req.json().catch(() => ({}));
  if (!String(b.service || "").trim()) return bad("Service is required.");
  if (!b.password) return bad("Password is required.");
  if (b.cardLast4 && !/^\d{4}$/.test(b.cardLast4)) return bad("Card last 4 digits must be exactly 4 digits.");
  const now = new Date();
  const doc = {
    service: String(b.service).trim(),
    name: String(b.name || "").trim(),
    username: b.username || "",
    notes: b.notes || "",
    encryptedPassword: encrypt(b.password),
    billingStatus: b.billingStatus === "suspended" ? "suspended" : "active",
    billingAmount: b.billingAmount || "",
    nextPaymentDate: b.nextPaymentDate || null,
    cardLast4: b.cardLast4 || "",
    createdBy: oid(s.id),
    createdByName: s.name,
    lastAccessedBy: null,
    lastAccessedByName: null,
    lastAccessedAt: null,
    accessLog: [],
    deleted: false,
    createdAt: now,
    updatedAt: now,
  };
  const db = await connectDB();
  const { insertedId } = await db.collection("credentials").insertOne(doc);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { encryptedPassword, accessLog, ...safe } = doc;
  return NextResponse.json({ _id: insertedId, ...safe });
}
