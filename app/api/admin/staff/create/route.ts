import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseService } from "@/lib/supabase/service";
import { staffEmailFromUsername } from "@/lib/auth/username";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me, error: meErr } = await supabase
    .from("profiles")
    .select("role,active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (meErr) return NextResponse.json({ error: meErr.message }, { status: 400 });
  if (!me?.active || me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const username = String(body.username || "").trim().toLowerCase();
  const full_name = String(body.full_name || "").trim();
  const temp_password = String(body.temp_password || "").trim();

  if (!username) return NextResponse.json({ error: "Username is required." }, { status: 400 });
  if (temp_password.length < 8) return NextResponse.json({ error: "Temp password must be 8+ chars." }, { status: 400 });

  const service = supabaseService();
  const email = staffEmailFromUsername(username);

  // create auth user
  const { data: created, error: cErr } = await service.auth.admin.createUser({
    email,
    password: temp_password,
    email_confirm: true,
    user_metadata: { full_name: full_name || null },
  });

  if (cErr) return NextResponse.json({ error: cErr.message }, { status: 400 });
  const uid = created.user?.id;
  if (!uid) return NextResponse.json({ error: "User creation failed." }, { status: 400 });

  // create profile row
  const { error: pErr } = await service.from("profiles").upsert({
    id: uid,
    username,
    full_name: full_name || null,
    role: "STAFF",
    active: true,
    force_password_change: true,
  });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, staff_user_id: uid, username });
}
