import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * IMPORTANT: Set these to match your DB enums exactly.
 * From your earlier messages, payment_status might be: unpaid | pending | confirmed (lowercase)
 */
const SALE_STATUS_PENDING = "PENDING";
const PAYMENT_STATUS_PENDING = "PENDING";   // change to "PENDING" if your enum is caps

type SaleItemInput = {
  product_id: string;
  qty: number;
};

export async function POST(req: Request) {
  try {
    const supabase = supabaseAdmin(); // bypass RLS (server only)
    const body = await req.json().catch(() => ({}));

    const payment_method = String(body.payment_method || "CASH").toUpperCase(); // CASH / MOMO
    const momo_reference =
      payment_method === "MOMO" && String(body.momo_reference || "").trim()
        ? String(body.momo_reference).trim()
        : null;

    const itemsRaw = Array.isArray(body.items) ? body.items : [];
    const items: SaleItemInput[] = itemsRaw
      .map((it: any) => ({
        product_id: String(it.product_id || "").trim(),
        qty: Number(it.qty || 0),
      }))
      .filter((x: SaleItemInput) => x.product_id && Number.isFinite(x.qty) && x.qty > 0);

    if (!items.length) {
      return NextResponse.json({ error: "Invalid items." }, { status: 400 });
    }

    // Ensure scan enabled
    const { data: settings, error: sErr } = await supabase
      .from("shop_settings")
      .select("enable_customer_scan")
      .eq("id", 1)
      .maybeSingle();

    if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });
    if (!settings?.enable_customer_scan) {
      return NextResponse.json({ error: "Scan checkout is turned off." }, { status: 403 });
    }

    // Fetch product prices (server is source of truth)
    const ids = Array.from(new Set(items.map((x) => x.product_id)));
    const { data: priceRows, error: priceErr } = await supabase
      .from("products")
      .select("id, price")
      .in("id", ids);

    if (priceErr) {
      return NextResponse.json({ error: `price lookup failed: ${priceErr.message}` }, { status: 400 });
    }

    const priceMap = new Map<string, number>();
    for (const r of priceRows ?? []) priceMap.set(r.id, Number((r as any).price || 0));

    // Create sale (retry on code collision)
    let lastErr: any = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode();

      const { data: sale, error: saleErr } = await supabase
        .from("sales")
        .insert({
          source: "CUSTOMER_SCAN",
          status: SALE_STATUS_PENDING,
          payment_method,
          payment_status: PAYMENT_STATUS_PENDING,
          momo_reference,
          public_code: code,
          note: "Customer scan",
        })
        .select("id, public_code")
        .single();

      if (saleErr) {
        lastErr = saleErr;
        const msg = String(saleErr.message || "").toLowerCase();
        const isDup =
          msg.includes("duplicate") || msg.includes("unique") || msg.includes("public_code");
        if (isDup) continue;

        return NextResponse.json({ error: saleErr.message }, { status: 400 });
      }

      // Build sale_items payload WITH required NOT NULL fields
      const payload = items.map((it) => {
        const unit = priceMap.get(it.product_id);
        if (unit == null) {
          throw new Error(`Missing price for product ${it.product_id}`);
        }
        const line = Number(unit) * Number(it.qty);

        return {
          sale_id: sale.id,
          product_id: it.product_id,
          qty: it.qty,
          unit_price_at_time: unit, // required by your DB
          line_total: line,         // keep IF your table has it; remove if not
        };
      });

      const { error: itemsErr } = await supabase.from("sale_items").insert(payload);

      if (itemsErr) {
        return NextResponse.json(
          { error: `sale_items insert failed: ${itemsErr.message}` },
          { status: 400 }
        );
      }

      return NextResponse.json({ ok: true, code: sale.public_code });
    }

    return NextResponse.json(
      { error: lastErr?.message || "Failed after retries." },
      { status: 400 }
    );
  } catch (e: any) {
    console.error("scan/create failed:", e);
    return NextResponse.json(
      { error: e?.message || "Internal server error." },
      { status: 500 }
    );
  }
}