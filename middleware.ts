import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname.startsWith("/scan") ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (isPublicPath(pathname)) return NextResponse.next();

  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return req.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            res.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: auth } = await supabase.auth.getUser();
  const user = auth.user;

  if (!user) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // role gate for admin routes
  if (pathname.startsWith("/admin")) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, active, force_password_change")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.active) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (profile.force_password_change) {
      const url = req.nextUrl.clone();
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }

    if (profile.role !== "ADMIN") {
      const url = req.nextUrl.clone();
      url.pathname = "/pos";
      return NextResponse.redirect(url);
    }
  }

  // force password change anywhere (except change-password)
  if (pathname !== "/change-password") {
    const { data: profile } = await supabase
      .from("profiles")
      .select("force_password_change, active, role")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.active) {
      const url = req.nextUrl.clone();
      url.pathname = "/login";
      return NextResponse.redirect(url);
    }

    if (profile?.force_password_change) {
      const url = req.nextUrl.clone();
      url.pathname = "/change-password";
      return NextResponse.redirect(url);
    }
  }

  return res;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
