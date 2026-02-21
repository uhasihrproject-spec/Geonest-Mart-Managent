import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

function startOfDayISO() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET() {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: me } = await supabase
    .from("profiles")
    .select("role, active")
    .eq("id", auth.user.id)
    .maybeSingle();

  if (!me?.active || me.role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const since = startOfDayISO();

  // Get paid sales today
  const { data: sales, error } = await supabase
    .from("sales")
    .select("total_amount, payment_method, source, status, created_at")
    .eq("status", "PAID")
    .gte("created_at", since);

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  let total = 0;
  let cash = 0;
  let momo = 0;
  let manual = 0;
  let scan = 0;
  let count = 0;

  for (const s of sales || []) {
    const amt = Number((s as any).total_amount || 0);
    total += amt;
    count += 1;

    if ((s as any).payment_method === "CASH") cash += amt;
    if ((s as any).payment_method === "MOMO") momo += amt;

    if ((s as any).source === "STAFF_MANUAL") manual += amt;
    if ((s as any).source === "CUSTOMER_SCAN") scan += amt;
  }

  // Settings (scan enabled)
  const { data: settings } = await supabase
    .from("shop_settings")
    .select("enable_customer_scan")
    .eq("id", 1)
    .maybeSingle();

  return NextResponse.json({
    ok: true,
    since,
    total,
    count,
    cash,
    momo,
    manual,
    scan,
    enable_customer_scan: Boolean((settings as any)?.enable_customer_scan),
  });
}
