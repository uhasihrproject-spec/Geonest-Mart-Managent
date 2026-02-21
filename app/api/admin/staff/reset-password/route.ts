import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";

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
  const temp_password = String(body.temp_password || "").trim();

  if (!id || temp_password.length < 8) {
    return NextResponse.json({ error: "Staff id required and temp password must be 8+ chars." }, { status: 400 });
  }

  const service = supabaseService();

  const { error: pwErr } = await service.auth.admin.updateUserById(id, { password: temp_password });
  if (pwErr) return NextResponse.json({ error: pwErr.message }, { status: 400 });

  const { error: pErr } = await service
    .from("profiles")
    .update({ force_password_change: true, active: true })
    .eq("id", id);

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
