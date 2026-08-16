import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  verifySessionToken,
} from "@/lib/auth/session";
import { isAdminPath } from "@/lib/security/paths";

const PUBLIC_PATHS = ["/login"];
const PUBLIC_API_PREFIXES = [
  "/api/auth/login",
  "/api/auth/me",
  "/api/auth/logout",
  "/api/auth/fix-team",
  "/api/auth/accounts",
  "/api/share",
  "/api/health",
];

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`))) {
    return true;
  }
  if (pathname.startsWith("/share/")) return true;
  if (PUBLIC_API_PREFIXES.some((p) => pathname.startsWith(p))) return true;
  return false;
}

// Behind a reverse proxy neither request.url nor nextUrl carries the public
// host: both report the internal listen address, which would redirect browsers
// to localhost. A relative Location is not an option either — the middleware
// runtime parses it with new URL() and throws ERR_INVALID_URL.
//
// So production redirects are anchored to the configured origin. Deriving it
// from Host/X-Forwarded-Host would be an open redirect: the proxy does not
// overwrite X-Forwarded-Host, so a request can carry a Host that matches our
// server_name while smuggling an attacker's host in the forwarded header.
// In development there is no proxy, so the request-derived origin is both
// accurate and necessary for LAN access (see allowedDevOrigins in next.config).
function externalOrigin(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    const configured = process.env.NEXT_PUBLIC_APP_URL?.trim();
    if (configured) {
      try {
        return new URL(configured).origin;
      } catch {
        // malformed config, fall through to the request-derived origin
      }
    }
  }
  return request.nextUrl.origin;
}

function redirectTo(request: NextRequest, pathname: string) {
  return NextResponse.redirect(new URL(pathname, externalOrigin(request)));
}

function loginRedirect(request: NextRequest, from: string) {
  return redirectTo(request, `/login?from=${encodeURIComponent(from)}`);
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (
    isPublicPath(pathname) ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon")
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "未登录" }, { status: 401 });
    }
    return loginRedirect(request, pathname);
  }

  const session = await verifySessionToken(token);
  if (!session) {
    const response = pathname.startsWith("/api/")
      ? NextResponse.json({ error: "登录已过期" }, { status: 401 })
      : redirectTo(request, "/login");
    response.cookies.set({
      name: SESSION_COOKIE,
      value: "",
      path: "/",
      maxAge: 0,
    });
    return response;
  }

  if (isAdminPath(pathname) && session.role !== "ADMIN") {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
    }
    return redirectTo(request, "/");
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|.*\\..*).*)"],
};
