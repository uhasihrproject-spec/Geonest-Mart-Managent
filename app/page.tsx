// app/page.tsx
import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();

  if (!auth.user) {
    redirect("/login");
  }

  // If logged in, send them somewhere useful
  redirect("//"); // or "/scan" or "/admin"
}