import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

// Optimistic check only: bounce signed-out visitors to /login before the
// page loads. Every API route still verifies the session itself.
const secret = new TextEncoder().encode(process.env.JWT_SECRET || "change-this-secret");

async function signedIn(req: NextRequest) {
  const token = req.cookies.get("ns_token")?.value;
  if (!token) return false;
  try {
    await jwtVerify(token, secret);
    return true;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const ok = await signedIn(req);
  if (pathname === "/login") {
    return ok ? NextResponse.redirect(new URL("/dashboard", req.url)) : NextResponse.next();
  }
  if (!ok) {
    const url = new URL("/login", req.url);
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Pages only — skip API routes, Next internals and static files.
  // Also skips the icon / share-image / manifest routes: link-preview bots aren't signed in.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|icon|apple-icon|opengraph-image|twitter-image|manifest.webmanifest|.*\\.(?:png|jpg|jpeg|svg|webp|ico|gif)$).*)"],
};
