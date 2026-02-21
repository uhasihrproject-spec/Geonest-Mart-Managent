import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role,active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!me?.active || me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const id = String(body.id || body.user_id || "").trim();
  const active = Boolean(body.active);

  if (!id) return NextResponse.json({ error: "Staff id required." }, { status: 400 });

  const { error } = await supabase.from("profiles").update({ active }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  
  return NextResponse.json({ ok: true });
}
