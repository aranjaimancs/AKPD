import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Paths that never require authentication. */
const PUBLIC_PREFIXES = ["/login", "/auth/", "/not-authorized"];

function isPublic(pathname: string) {
  return PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Build a Supabase client that can read/write cookies on the response ──
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Write updated cookies to both the request and the response so the
          // refreshed session is visible immediately on this request.
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ── Validate the session (also refreshes an expiring token) ──
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ── Routing rules ──────────────────────────────────────────────────────────

  // Already logged in and heading to /login or /not-authorized → send them home
  if (user && (pathname.startsWith("/login") || pathname.startsWith("/not-authorized"))) {
    return NextResponse.redirect(new URL("/seniors", request.url));
  }

  // Not logged in and requesting a protected page → send to login
  if (!user && !isPublic(pathname)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Admin-only routes — role is stored in user_metadata by the auth callback
  if (user && pathname.startsWith("/admin")) {
    const role = user.user_metadata?.role as string | undefined;
    if (role !== "admin") {
      return NextResponse.redirect(new URL("/seniors", request.url));
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match every route except:
     *  - _next/static  (static files)
     *  - _next/image   (image optimisation)
     *  - favicon.ico
     *  - seniors-content/* (headshot image serving)
     *  - common image/font extensions
     */
    "/((?!_next/static|_next/image|favicon\\.ico|seniors-content|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
