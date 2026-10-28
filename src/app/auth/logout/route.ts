import { getSupabaseServerClient } from "@/lib/supabase/server";

function loginRedirect(query: "logged_out=1" | "error=logout" | "error=auth_unavailable") {
  return new Response(null, { status: 303, headers: { Location: `/login?${query}` } });
}

async function logout() {
  const supabase = await getSupabaseServerClient();
  if (!supabase) return loginRedirect("error=auth_unavailable");

  try {
    const { error } = await supabase.auth.signOut();
    if (error) return loginRedirect("error=logout");
    return loginRedirect("logged_out=1");
  } catch {
    return loginRedirect("error=logout");
  }
}

export async function GET() {
  return logout();
}

export async function POST() {
  return logout();
}
