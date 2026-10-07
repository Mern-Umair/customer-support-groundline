import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "gl_session";
const PROTECTED_PREFIXES = ["/dashboard"];
const AUTH_PAGES = ["/login", "/signup"];

/**
 * Optimistic redirects only: checks for the presence of the session cookie.
 * Real verification happens in the Data Access Layer (src/lib/auth/dal.ts).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasCookie = request.cookies.has(SESSION_COOKIE);

  if (!hasCookie && PROTECTED_PREFIXES.some((p) => pathname.startsWith(p))) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }
  if (hasCookie && AUTH_PAGES.includes(pathname)) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/login", "/signup"],
};
