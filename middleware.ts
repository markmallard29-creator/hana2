import { NextResponse, type NextRequest } from "next/server";
import { authToken } from "@/lib/auth";

/**
 * Single-password gate. Set APP_PASSWORD to turn it on.
 * Public routes: login, unsubscribe, the browser view of sent newsletters.
 */
const PUBLIC = [/^\/login/, /^\/api\/login/, /^\/api\/health/, /^\/unsubscribe\//, /^\/api\/unsubscribe/, /^\/view\//];

export async function middleware(req: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((r) => r.test(pathname))) return NextResponse.next();

  const cookie = req.cookies.get("hana_auth")?.value;
  if (cookie && cookie === (await authToken(password))) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.searchParams.set("next", pathname);
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|jpg|ico)$).*)"],
};
