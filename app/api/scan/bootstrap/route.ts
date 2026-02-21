import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await supabaseServer();

  // read scan enabled (single-shop)
  const { data: settings, error: sErr } = await supabase
    .from("shop_settings")
    .select("enable_customer_scan")
    .eq("id", 1)
    .maybeSingle();

  if (sErr) return NextResponse.json({ error: sErr.message }, { status: 400 });

  const enabled = Boolean(settings?.enable_customer_scan);

  // products (active)
  const { data: products, error: pErr } = await supabase
    .from("products")
    .select("id,name,price,sku")
    .eq("is_active", true)
    .order("name", { ascending: true });

  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ enabled, products: products ?? [] });
}
