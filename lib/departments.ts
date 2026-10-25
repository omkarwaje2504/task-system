import "server-only";
import type { Db, ObjectId } from "mongodb";
import { isId, notDeleted, oid } from "./db";

/** Created the first time the list is read, so a fresh database starts with these. */
export const DEFAULT_DEPARTMENTS = ["Video", "Graphic", "IT"];

export async function listDepartments(db: Db) {
  const col = db.collection("departments");
  if (!(await col.estimatedDocumentCount())) {
    const now = new Date();
    await col.insertMany(DEFAULT_DEPARTMENTS.map((name, order) => ({ name, order, deleted: false, createdAt: now, updatedAt: now })));
  }
  return col.find(notDeleted).sort({ order: 1, name: 1 }).toArray();
}

/** A project's departments from the request: only ids of departments that exist, no repeats. */
export async function cleanDepartments(db: Db, v: unknown): Promise<ObjectId[]> {
  if (!Array.isArray(v)) return [];
  const ids = [...new Set(v.filter(isId))].map(oid);
  if (!ids.length) return [];
  const found = await db.collection("departments").find({ _id: { $in: ids }, ...notDeleted }).project({ _id: 1 }).toArray();
  const ok = new Set(found.map((d) => String(d._id)));
  return ids.filter((id) => ok.has(String(id)));
}
