import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const SALE_STATUS_PAID = "PAID";
const PAYMENT_STATUS_CONFIRMED = "CONFIRMED";

export async function POST(req: Request) {
  try {
    // must be signed in (staff/admin)
    const supaUser = await supabaseServer();
    const { data: auth } = await supaUser.auth.getUser();
    const uid = auth.user?.id;

    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const code = String(body.code || "").trim();

    if (!code) return NextResponse.json({ error: "Missing code." }, { status: 400 });

    const supabase = supabaseAdmin();

    // Load sale first
    const { data: sale, error: sErr } = await supabase
      .from("sales")
      .select("id, status, payment_status, source")
      .eq("public_code", code)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!sale) return NextResponse.json({ error: "Code not found." }, { status: 404 });

    if (sale.source !== "CUSTOMER_SCAN") {
      return NextResponse.json({ error: "Not a scan checkout code." }, { status: 400 });
    }

    // prevent double-confirm
    if (String(sale.status).toUpperCase() === "PAID" || String(sale.payment_status).toUpperCase() === "CONFIRMED") {
      return NextResponse.json({ error: "This code has already been used." }, { status: 409 });
    }

    // confirm payment
    const { error: uErr } = await supabase
      .from("sales")
      .update({
        status: SALE_STATUS_PAID,
        payment_status: PAYMENT_STATUS_CONFIRMED,
        staff_id: uid,
      })
      .eq("id", sale.id);

    if (uErr) return NextResponse.json({ error: uErr.message }, { status: 400 });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("scan/confirm failed:", e);
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}