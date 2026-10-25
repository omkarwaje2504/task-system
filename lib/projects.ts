import "server-only";
import type { Db, Document, ObjectId } from "mongodb";
import { notDeleted } from "./db";

/** Joins product type, brand and company onto projects for display. */
export const PROJECT_LOOKUPS: Document[] = [
  { $lookup: { from: "productTypes", localField: "productType", foreignField: "_id", as: "type" } },
  { $unwind: { path: "$type", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "brands", localField: "brand", foreignField: "_id", as: "brand" } },
  { $unwind: { path: "$brand", preserveNullAndEmptyArrays: true } },
  { $lookup: { from: "companies", localField: "company", foreignField: "_id", as: "company" } },
  { $unwind: { path: "$company", preserveNullAndEmptyArrays: true } },
];

export const TYPE_FIELDS = { "type._id": 1, "type.name": 1, "type.slug": 1, "type.icon": 1, "type.special": 1, "type.checklistOn": 1 };

export async function getProject(db: Db, id: ObjectId) {
  const [p] = await db.collection("projects").aggregate([
    { $match: { _id: id, ...notDeleted } },
    ...PROJECT_LOOKUPS,
    { $project: { "brand.key": 0, "company.key": 0, "type.steps": 0 } },
  ]).toArray();
  return p || null;
}

/** Re-sums an RxPad-style step's daily logs into step.data.totals. */
export async function refreshTotals(db: Db, projectId: ObjectId, stepId: string) {
  const [t] = await db.collection("progress").aggregate([
    { $match: { project: projectId, stepId, ...notDeleted } },
    { $group: { _id: null, added: { $sum: "$added" }, completed: { $sum: "$completed" }, declined: { $sum: "$declined" } } },
  ]).toArray();
  const totals = { added: t?.added || 0, completed: t?.completed || 0, declined: t?.declined || 0 };
  await db.collection("projects").updateOne(
    { _id: projectId, "steps.id": stepId },
    { $set: { "steps.$.data.totals": totals, updatedAt: new Date() } },
  );
  return totals;
}
