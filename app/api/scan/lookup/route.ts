import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function GET(req: Request) {
  try {
    const supabase = supabaseAdmin();

    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get("code") || "").trim();

    
    if (!code || code.length < 4) {
      return NextResponse.json({ error: "Invalid code." }, { status: 400 });
    }

    // Fetch sale + items + product names
    const { data: sale, error } = await supabase
      .from("sales")
      .select(
        `
        id,
        public_code,
        source,
        status,
        payment_method,
        payment_status,
        momo_reference,
        created_at,
        sale_items (
          id,
          product_id,
          qty,
          unit_price_at_time,
          line_total,
          products:product_id ( id, name, sku )
        )
      `
      )
      .eq("public_code", code)
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    if (!sale) return NextResponse.json({ error: "Code not found." }, { status: 404 });

    // Optional: only allow scan-source codes
    if (sale.source !== "CUSTOMER_SCAN") {
      return NextResponse.json({ error: "This code is not a scan checkout." }, { status: 400 });
    }

    const ps = String(sale.payment_status || "").toUpperCase();
    const st = String(sale.status || "").toUpperCase();
    return NextResponse.json({
    ok: true,
    code: sale.public_code,
    payment_status: sale.payment_status,
    status: sale.status,
    paid: ps === "CONFIRMED" || st === "PAID",
    sale, // keep full object for receipt details
    });

  } catch (e: any) {
    console.error("scan/lookup failed:", e);
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}