import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

export async function updateSession(request) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isApiRoute = pathname.startsWith("/api/");

  const publicPaths = [
    "/login",
    "/register",
    "/auth/callback",
    "/impressum",
    "/datenschutz",
  ];
  const isPublic = publicPaths.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`)
  );
  const isAuthPage = pathname === "/login" || pathname === "/register";

  if (!user && !isPublic && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && !isApiRoute) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "privacy_accepted_at, age_confirmed_at, onboarding_abgeschlossen"
      )
      .eq("id", user.id)
      .single();

    const hasConsent =
      !!profile?.privacy_accepted_at && !!profile?.age_confirmed_at;
    const onboardingComplete = !!profile?.onboarding_abgeschlossen;

    const destinationAfterAuth = !hasConsent
      ? "/consent"
      : !onboardingComplete
        ? "/onboarding"
        : "/chat";

    if (isAuthPage) {
      const url = request.nextUrl.clone();
      url.pathname = destinationAfterAuth;
      return NextResponse.redirect(url);
    }

    if (!hasConsent && pathname !== "/consent") {
      const url = request.nextUrl.clone();
      url.pathname = "/consent";
      return NextResponse.redirect(url);
    }

    if (hasConsent && pathname === "/consent") {
      const url = request.nextUrl.clone();
      url.pathname = onboardingComplete ? "/chat" : "/onboarding";
      return NextResponse.redirect(url);
    }

    if (hasConsent && !onboardingComplete && pathname !== "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/onboarding";
      return NextResponse.redirect(url);
    }

    if (onboardingComplete && pathname === "/onboarding") {
      const url = request.nextUrl.clone();
      url.pathname = "/chat";
      return NextResponse.redirect(url);
    }

    if (pathname === "/") {
      const url = request.nextUrl.clone();
      url.pathname = destinationAfterAuth;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
