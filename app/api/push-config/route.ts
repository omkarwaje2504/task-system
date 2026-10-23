import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { firebaseWebConfig } from "@/lib/firebaseConfig";

/** Firebase web config for turning on push in the browser (signed-in users only). */
export async function GET() {
  const s = await requireUser();
  if (s instanceof NextResponse) return s;
  return NextResponse.json(firebaseWebConfig());
}
