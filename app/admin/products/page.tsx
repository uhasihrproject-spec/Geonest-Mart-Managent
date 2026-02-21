"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Product = { id: string; name: string; price: number; sku: string | null; is_active: boolean };

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

const INP = "w-full rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-[13px] text-[#1A1A1A] placeholder-[#ABABAB] outline-none focus:ring-2 focus:ring-[#c0392b]/15 focus:border-[#c0392b]/40 transition-all";
const LABEL = "block text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2";

export default function ProductsPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [sku, setSku] = useState("");
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (flash) { const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t); }
  }, [flash]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("products").select("id,name,price,sku,is_active").order("name");
    setLoading(false);
    if (error) return setFlash({ type: "err", text: error.message });
    setRows((data as any) || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(n) || (r.sku || "").toLowerCase().includes(n));
  }, [rows, q]);

  async function addProduct() {
    const p = Number(price);
    if (!name.trim()) return setFlash({ type: "err", text: "Name required." });
    if (!Number.isFinite(p) || p < 0) return setFlash({ type: "err", text: "Invalid price." });
    const { error } = await supabase.from("products").insert({ name: name.trim(), price: p, sku: sku.trim() || null, is_active: true });
    if (error) return setFlash({ type: "err", text: error.message });
    setName(""); setPrice(""); setSku(""); setShowAdd(false);
    setFlash({ type: "ok", text: "Product added." });
    load();
  }

  async function updatePrice(prod: Product, newPrice: number) {
    const { error: uErr } = await supabase.from("products").update({ price: newPrice }).eq("id", prod.id);
    if (uErr) return setFlash({ type: "err", text: uErr.message });
    const { data: auth } = await supabase.auth.getUser();
    await supabase.from("price_history").insert({ product_id: prod.id, old_price: prod.price, new_price: newPrice, changed_by: auth.user?.id });
    setFlash({ type: "ok", text: "Price updated." });
    load();
  }

  return (
    <div className="max-w-4xl mx-auto px-5 py-8" style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] text-[#ABABAB] uppercase tracking-widest mb-2">Catalogue</p>
          <h1 className="text-[28px] text-[#1A1A1A] font-[300] leading-tight">Products</h1>
        </div>
        <button
          onClick={() => setShowAdd((v) => !v)}
          className="flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-4 py-2 text-[12px] text-[#6B6B6B] hover:bg-[#FAFAFA] transition-all flex-shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
          {showAdd ? "Cancel" : "Add product"}
        </button>
      </div>

      {/* Toast */}
      <AnimatePresence>
        {flash && (
          <motion.div
            key="flash"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className={[
              "mb-5 rounded-2xl px-5 py-4 text-[13px]",
              flash.type === "ok" ? "bg-[#F0FDF4] text-[#16A34A] border border-green-100" : "bg-red-50 text-red-500 border border-red-100",
            ].join(" ")}
          >
            {flash.text}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add form */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            key="add-form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-2xl border border-[#F0F0F0] p-6 mb-6">
              <p className="text-[15px] text-[#1A1A1A] font-[400] mb-5">New product</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className={LABEL}>Name</label>
                  <input className={INP} placeholder="e.g. Fresh Juice" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Price (GHS)</label>
                  <input className={INP} placeholder="0.00" type="number" min="0" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>SKU</label>
                  <input className={INP} placeholder="Optional" value={sku} onChange={(e) => setSku(e.target.value)} />
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={addProduct} className="rounded-full bg-[#c0392b] px-6 py-2.5 text-[12px] text-white hover:bg-[#a93226] transition-colors">
                  Add product
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-5">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ABABAB] pointer-events-none">
          <circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <input
          className="w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] pl-10 pr-4 py-3 text-[13px] text-[#1A1A1A] placeholder-[#ABABAB] outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 focus:bg-white transition-all"
          placeholder="Search products…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
        {/* Column headers */}
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#F8F8F8]">
          <div className="col-span-5 text-[10px] text-[#ABABAB] uppercase tracking-widest">Product</div>
          <div className="col-span-2 text-[10px] text-[#ABABAB] uppercase tracking-widest">SKU</div>
          <div className="col-span-2 text-[10px] text-[#ABABAB] uppercase tracking-widest">Price</div>
          <div className="col-span-3 text-[10px] text-[#ABABAB] uppercase tracking-widest">Update</div>
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-[#FAFAFA] animate-pulse" style={{ animationDelay: `${i * 0.06}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#CACACA] font-[300]">{q ? "No results" : "No products yet"}</p>
            <p className="text-[11px] text-[#D8D8D8] mt-1">{q ? "Try different keywords" : "Add your first product above"}</p>
          </div>
        ) : (
          filtered.map((p, i) => (
            <ProductRow key={p.id} p={p} index={i} total={filtered.length} onUpdate={updatePrice} />
          ))
        )}
      </div>
    </div>
  );
}

function ProductRow({ p, index, total, onUpdate }: { p: Product; index: number; total: number; onUpdate: (p: Product, n: number) => Promise<void> }) {
  const [val, setVal] = useState(String(p.price));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setVal(String(p.price)); }, [p.price]);

  const canSave = (() => { const n = Number(val); return Number.isFinite(n) && n >= 0 && n !== p.price; })();

  async function save() {
    setSaving(true);
    await onUpdate(p, Number(val));
    setSaving(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: Math.min(index * 0.025, 0.3), duration: 0.2 }}
    >
      {/* Desktop */}
      <div className={["hidden sm:grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-[#FAFAFA] transition-colors", index < total - 1 ? "border-b border-[#F8F8F8]" : ""].join(" ")}>
        <div className="col-span-5">
          <p className="text-[13px] text-[#1A1A1A]">{p.name}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[12px] text-[#ABABAB]">{p.sku || "—"}</p>
        </div>
        <div className="col-span-2">
          <p className="text-[13px] text-[#1A1A1A]">GHS {fmt(p.price)}</p>
        </div>
        <div className="col-span-3 flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#ABABAB] pointer-events-none">GHS</span>
            <input
              className="w-full rounded-lg border border-[#E8E8E8] bg-[#FAFAFA] focus:bg-white pl-9 pr-3 py-1.5 text-[12px] text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 transition-all"
              value={val}
              onChange={(e) => setVal(e.target.value)}
              type="number" min="0" step="0.01"
            />
          </div>
          <button
            disabled={!canSave || saving}
            onClick={save}
            className="rounded-lg bg-[#c0392b] px-3 py-1.5 text-[11px] text-white hover:bg-[#a93226] disabled:opacity-30 disabled:cursor-not-allowed transition-all"
          >
            {saving ? "…" : "Save"}
          </button>
        </div>
      </div>

      {/* Mobile */}
      <div className={["sm:hidden px-4 py-4", index < total - 1 ? "border-b border-[#F8F8F8]" : ""].join(" ")}>
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-[13px] text-[#1A1A1A]">{p.name}</p>
            <p className="text-[11px] text-[#ABABAB] mt-0.5">{p.sku ? `SKU: ${p.sku}` : "No SKU"} · GHS {fmt(p.price)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] text-[#ABABAB]">GHS</span>
            <input className="w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] focus:bg-white pl-9 pr-3 py-2.5 text-[12px] text-[#1A1A1A] outline-none focus:ring-2 focus:ring-[#c0392b]/12 transition-all" value={val} onChange={(e) => setVal(e.target.value)} type="number" min="0" step="0.01" />
          </div>
          <button disabled={!canSave || saving} onClick={save} className="rounded-xl bg-[#c0392b] px-4 py-2.5 text-[12px] text-white hover:bg-[#a93226] disabled:opacity-30 transition-all">
            {saving ? "…" : "Save"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}