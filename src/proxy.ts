import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { APP_ROLES, roleHome, type AppRole } from "@/lib/auth/roles";
import { getServerSupabaseCookieOptions } from "@/lib/supabase/cookies";
import { isAccountSuspended } from "@/lib/auth/suspension";
import { getSupabasePublicConfig } from "@/lib/supabase/config";

function protectedRole(pathname: string): AppRole | null {
  const role = APP_ROLES.find(
    candidate =>
      pathname === `/${candidate}` || pathname.startsWith(`/${candidate}/`)
  );
  return role ?? null;
}

function redirectWithCookies(
  request: NextRequest,
  path: string,
  response: NextResponse
) {
  const destination = NextResponse.redirect(
    new URL(path, request.nextUrl),
    303
  );
  for (const cookie of response.cookies.getAll())
    destination.cookies.set(cookie);
  return destination;
}

export async function proxy(request: NextRequest) {
  const pathRole = protectedRole(request.nextUrl.pathname);
  const config = getSupabasePublicConfig();
  if (!config) {
    if (!pathRole) return NextResponse.next({ request });
    const params = new URLSearchParams({ error: "auth_unavailable" });
    return NextResponse.redirect(
      new URL(`/login?${params}`, request.nextUrl),
      303
    );
  }

  let response = NextResponse.next({ request });
  const cookieOptions = getServerSupabaseCookieOptions();
  const supabase = createServerClient(config.url, config.key, {
    cookieOptions,
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          request.cookies.set(name, value);
          response.cookies.set(name, value, { ...options, ...cookieOptions });
        });
      },
    },
  });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (!pathRole) return response;

  if (authError || !authData.user) {
    if (pathRole === "admin" && request.nextUrl.pathname === "/admin") {
      const params = new URLSearchParams({ next: "/admin" });
      return redirectWithCookies(request, `/login?${params}`, response);
    }
    if (pathRole === "admin")
      return new NextResponse("Not Found", { status: 404 });
    const next = `${request.nextUrl.pathname}${request.nextUrl.search}`;
    const params = new URLSearchParams({ next });
    return redirectWithCookies(request, `/login?${params}`, response);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role,is_suspended")
    .eq("id", authData.user.id)
    .maybeSingle();
  const role = profile?.role;
  if (
    profileError ||
    typeof role !== "string" ||
    !APP_ROLES.includes(role as AppRole)
  ) {
    if (!profileError) await supabase.auth.signOut();
    const params = new URLSearchParams({ error: "role_unverified" });
    return redirectWithCookies(request, `/login?${params}`, response);
  }

  if (role !== pathRole) {
    if (pathRole === "admin")
      return new NextResponse("Not Found", { status: 404 });
    return redirectWithCookies(request, roleHome[role as AppRole], response);
  }
  if (isAccountSuspended(profile))
    return redirectWithCookies(request, "/account-suspended", response);
  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manus-routes.json|lexify-mark.svg).*)",
  ],
};
