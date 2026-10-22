import "server-only";
import type { Db, ObjectId } from "mongodb";
import type { Session } from "./auth";
import { oid } from "./db";

export async function logActivity(
  db: Db,
  s: Session,
  type: string,
  message: string,
  extra: { project?: ObjectId | string; task?: ObjectId | string } = {},
) {
  await db.collection("activity").insertOne({
    type,
    message,
    user: oid(s.id),
    userName: s.name,
    project: extra.project ? oid(extra.project) : null,
    task: extra.task ? oid(extra.task) : null,
    createdAt: new Date(),
  });
}
