import { NextResponse } from "next/server";
import { connectDB, notDeleted, oid } from "@/lib/db";
import { bad, requireUser } from "@/lib/auth";
import { decrypt, encrypt } from "@/lib/crypto";

// Passwords are shown straight in the list (decrypted here for signed-in
// users); the encrypted blob itself never leaves the server.
const LIST_FIELDS = {
  service: 1, name: 1, username: 1, notes: 1, createdBy: 1, createdByName: 1,
  createdAt: 1, updatedAt: 1, encryptedPassword: 1,
  billingStatus: 1, billingAmount: 1, nextPaymentDate: 1, cardLast4: 1,
};

function withPassword({ encryptedPassword, ...c }: Record<string, unknown>) {
  let password: string | null = null;
  try {
    password = encryptedPassword ? decrypt(encryptedPassword as Parameters<typeof decrypt>[0]) : null;
  } catch {
    password = null; // CREDENTIALS_SECRET changed — the page says it can't be read
  }
  return { ...c, password };
}

export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const creds = await db.collection("credentials").find(notDeleted, { projection: LIST_FIELDS }).sort({ service: 1, name: 1 }).toArray();
  return NextResponse.json(creds.map(withPassword));
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
