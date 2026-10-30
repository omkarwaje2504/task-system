import { after, NextResponse } from "next/server";
import { connectDB, notDeleted } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { sendDueReminders } from "@/lib/taskReminders";

/**
 * Tasks waiting for my acknowledgement — polled by the app shell to flash the
 * tab title and ring the bell. Also nudges the every-minute reminder pushes.
 */
export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  const db = await connectDB();
  const items = await db.collection("generalTasks").find(
    { ...notDeleted, done: { $ne: true }, assignees: s.id, "acks.user": { $ne: s.id } },
    { projection: { text: 1, createdByName: 1, createdAt: 1 } },
  ).sort({ createdAt: -1 }).limit(20).toArray();
  after(() => sendDueReminders(db).catch((e) => console.error("Task reminders failed:", e)));
  return NextResponse.json({ count: items.length, items });
}
