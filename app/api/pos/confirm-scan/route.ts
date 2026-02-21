import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(req: Request) {
  const supabase = await supabaseServer();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const code = String(body.code || "").trim();
  if (!code) return NextResponse.json({ error: "Code required." }, { status: 400 });

  // mark paid/confirmed (no inserting items here!)
  const { data: sale, error } = await supabase
    .from("sales")
    .update({
      status: "PAID",              // adjust if your enum is lowercase
      payment_status: "confirmed", // your enum: unpaid|pending|confirmed
      staff_id: auth.user.id,
    })
    .eq("public_code", code)
    .select("id, public_code")
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (!sale) return NextResponse.json({ error: "Invalid code." }, { status: 404 });

  return NextResponse.json({ ok: true, sale_id: sale.id, code: sale.public_code });
}