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

  if (!id) return NextResponse.json({ error: "Staff id required." }, { status: 400 });
  if (id === auth.user.id) return NextResponse.json({ error: "You cannot remove your own account." }, { status: 400 });

  const { data: target } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", id)
    .maybeSingle();

  if (!target || target.role !== "STAFF") {
    return NextResponse.json({ error: "Only staff accounts can be removed." }, { status: 400 });
  }

  const service = supabaseService();

  const { error: pErr } = await service.from("profiles").delete().eq("id", id);
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  const { error: uErr } = await service.auth.admin.deleteUser(id);
  if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

  return NextResponse.json({ ok: true });
}
