import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { bad, setAuthCookie, signToken, type Session } from "@/lib/auth";

export async function POST(req: Request) {
  const { email, password } = await req.json().catch(() => ({}));
  if (!email || !password) return bad("Enter your email and password.");
  const db = await connectDB();
  const user = await db.collection("users").findOne({
    email: String(email).trim().toLowerCase(),
    deleted: { $ne: true },
  });
  if (!user || !(await bcrypt.compare(String(password), user.password))) {
    return bad("Wrong email or password.", 401);
  }
  if (user.active === false) return bad("Your account is switched off. Ask an admin.", 403);
  const session: Session = { id: user._id.toString(), name: user.name, role: user.role, email: user.email };
  await db.collection("users").updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });
  const res = NextResponse.json(session);
  setAuthCookie(res, await signToken(session));
  return res;
}
