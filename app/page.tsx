// app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    redirect("/login");
  }

  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, force_password_change, active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!profile?.active) {
    redirect("/login");
  }

  if (profile?.force_password_change) {
    redirect("/change-password");
  }

  redirect(profile?.role === "ADMIN" ? "/admin/dashboard" : "/pos");
}
