import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();

  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (!me?.active || me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const enable = Boolean(body.enable);

  const { error } = await supabase
    .from("shop_settings")
    .update({ enable_customer_scan: enable })
    .eq("id", 1);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json({ ok: true, enable_customer_scan: enable });
}
