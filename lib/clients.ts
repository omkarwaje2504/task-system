import "server-only";
import type { Db, ObjectId } from "mongodb";
import { nameKey, notDeleted } from "./db";

// Companies and brands are matched on a normalized key so "Dr. Reddy's"
// and "dr reddys" resolve to the same record instead of a duplicate.

export async function resolveCompany(db: Db, name: string | undefined | null): Promise<ObjectId | null> {
  const clean = (name || "").trim();
  if (!clean) return null;
  const key = nameKey(clean);
  const existing = await db.collection("companies").findOne({ key, ...notDeleted });
  if (existing) return existing._id;
  const now = new Date();
  const { insertedId } = await db.collection("companies").insertOne({ name: clean, key, deleted: false, createdAt: now, updatedAt: now });
  return insertedId;
}

export async function resolveBrand(
  db: Db,
  name: string | undefined | null,
  company: ObjectId | null,
): Promise<{ brand: ObjectId | null; company: ObjectId | null }> {
  const clean = (name || "").trim();
  if (!clean) return { brand: null, company };
  const key = nameKey(clean);
  const existing = await db.collection("brands").findOne({ key, ...notDeleted });
  if (existing) {
    // A brand belongs to one company. If it had none yet, attach it now.
    if (!existing.company && company) {
      await db.collection("brands").updateOne({ _id: existing._id }, { $set: { company, updatedAt: new Date() } });
      return { brand: existing._id, company };
    }
    return { brand: existing._id, company: existing.company || company };
  }
  const now = new Date();
  const { insertedId } = await db.collection("brands").insertOne({ name: clean, key, company, deleted: false, createdAt: now, updatedAt: now });
  return { brand: insertedId, company };
}
