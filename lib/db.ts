import { ObjectId } from "mongodb";
import { connectDB } from "./mongodb";

export { connectDB };

export const oid = (id: unknown) =>
  id instanceof ObjectId ? id : new ObjectId(String(id));

export function isId(id: unknown): id is string {
  return typeof id === "string" && ObjectId.isValid(id);
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Matching key used to avoid duplicates: "Dr. Reddy's" and "dr reddys" collide. */
export function nameKey(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export const notDeleted = { deleted: { $ne: true } };
