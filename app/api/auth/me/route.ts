import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";

export async function GET() {
  const s = await requireUser();
  return s instanceof NextResponse ? s : NextResponse.json(s);
}
