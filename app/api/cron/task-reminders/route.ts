import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { sendDueReminders } from "@/lib/taskReminders";

/**
 * Every-minute reminder pushes for unacknowledged general tasks, for when
 * nobody has the app open. Call it each minute from a scheduler with
 * `Authorization: Bearer <CRON_SECRET>` (Vercel Cron sends this header itself).
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Not allowed." }, { status: 401 });
  }
  const sent = await sendDueReminders(await connectDB());
  return NextResponse.json({ ok: true, sent });
}
