import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

function genCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

const SALE_STATUS_PAID = "PAID";
const PAYMENT_STATUS_CONFIRMED = "CONFIRMED";

type SaleItemInput = {
  product_id: string;
  qty: number;
};

export async function POST(req: Request) {
  try {
    // ensure logged in (staff/admin)
    const supaUser = await supabaseServer();
    const { data: auth } = await supaUser.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const payment_method = String(body.payment_method || "CASH").toUpperCase();
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

    // Use admin client (bypass RLS)
    const supabase = supabaseAdmin();

    // Fetch prices (server truth)
    const ids = Array.from(new Set(items.map((x) => x.product_id)));
    const { data: priceRows, error: priceErr } = await supabase
      .from("products")
      .select("id, price")
      .in("id", ids);

    if (priceErr) return NextResponse.json({ error: priceErr.message }, { status: 400 });

    const priceMap = new Map<string, number>();
    for (const r of priceRows ?? []) priceMap.set(r.id, Number((r as any).price || 0));

    // Create sale (retry unique public_code collisions)
    let lastErr: any = null;

    for (let attempt = 0; attempt < 6; attempt++) {
      const code = genCode();

      const { data: sale, error: sErr } = await supabase
        .from("sales")
        .insert({
          source: "STAFF_MANUAL",
          status: SALE_STATUS_PAID,
          staff_id: uid,
          payment_method,
          payment_status: PAYMENT_STATUS_CONFIRMED,
          momo_reference,
          public_code: code,
          note: "Manual POS",
        })
        .select("id, public_code")
        .single();

      if (sErr) {
        lastErr = sErr;
        const msg = String(sErr.message || "").toLowerCase();
        const isDup = msg.includes("duplicate") || msg.includes("unique") || msg.includes("public_code");
        if (isDup) continue;
        return NextResponse.json({ error: sErr.message }, { status: 400 });
      }

      // Insert sale_items with required columns
      const payload = items.map((it) => {
        const unit = priceMap.get(it.product_id);
        if (unit == null) throw new Error(`Missing price for product ${it.product_id}`);
        const line = unit * it.qty;

        return {
          sale_id: sale.id,
          product_id: it.product_id,
          qty: it.qty,
          unit_price_at_time: unit,
          line_total: line, // remove if your table doesn't have it
        };
      });

      const { error: iErr } = await supabase.from("sale_items").insert(payload);
      if (iErr) {
        return NextResponse.json({ error: `sale_items insert failed: ${iErr.message}` }, { status: 400 });
      }

      return NextResponse.json({ ok: true, code: sale.public_code });
    }

    return NextResponse.json({ error: lastErr?.message || "Failed after retries." }, { status: 400 });
  } catch (e: any) {
    console.error("pos/create failed:", e);
    return NextResponse.json({ error: e?.message || "Server error." }, { status: 500 });
  }
}
