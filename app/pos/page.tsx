"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Product = { id: string; name: string; price: number; sku: string | null };
type CartItem = { product: Product; qty: number };

type ScanSaleItem = {
  id: string;
  qty: number;
  unit_price_at_time: number;
  line_total: number;
  products: { id: string; name: string; sku: string | null } | null;
};

type ScanSale = {
  id: string;
  public_code: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  momo_reference: string | null;
  created_at: string;
  sale_items: ScanSaleItem[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function money(n: number) { return `GHS ${fmt(n)}`; }

// Soft pastel color per product initial
const CARD_PALETTES = [
  { bg: "#FFF0EE", accent: "#c0392b", text: "#c0392b" },
  { bg: "#EFF6FF", accent: "#2563EB", text: "#1D4ED8" },
  { bg: "#F0FDF4", accent: "#16A34A", text: "#15803D" },
  { bg: "#FFFBEB", accent: "#D97706", text: "#B45309" },
  { bg: "#F5F3FF", accent: "#7C3AED", text: "#6D28D9" },
  { bg: "#FFF0F8", accent: "#DB2777", text: "#BE185D" },
  { bg: "#ECFDF5", accent: "#059669", text: "#047857" },
  { bg: "#FEF2F2", accent: "#DC2626", text: "#B91C1C" },
];

function palette(name: string) {
  return CARD_PALETTES[name.charCodeAt(0) % CARD_PALETTES.length];
}

export default function POSPage() {
  const supabase = supabaseBrowser();
  const [products, setProducts] = useState<Product[]>([]);
  const [topIds, setTopIds] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [cartOpen, setCartOpen] = useState(false);
  const [payMethod, setPayMethod] = useState<"CASH" | "MOMO">("CASH");
  const [momoRef, setMomoRef] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [codeOpen, setCodeOpen] = useState(false);
  const [scanCode, setScanCode] = useState("");
  const [scanBusy, setScanBusy] = useState(false);
  const [scanErr, setScanErr] = useState<string | null>(null);
  const [scanSale, setScanSale] = useState<ScanSale | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  const scanTotal = useMemo(() => {
  if (!scanSale) return 0;
  return (scanSale.sale_items || []).reduce((s, it) => s + Number(it.line_total || 0), 0);
  }, [scanSale]);

  const scanCount = useMemo(() => {
    if (!scanSale) return 0;
    return (scanSale.sale_items || []).reduce((s, it) => s + Number(it.qty || 0), 0);
  }, [scanSale]);

  async function lookupScanCode() {
  setScanErr(null);
  setScanSale(null);
  const code = scanCode.trim();
  if (!code) { setScanErr("Enter the 6-digit code."); return; }

  setScanBusy(true);
  try {
    const res = await fetch(`/api/scan/lookup?code=${encodeURIComponent(code)}`, { method: "GET" });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setScanErr(json?.error || `Error ${res.status}`); setScanBusy(false); return; }
    setScanSale(json.sale as ScanSale);
  } catch {
    setScanErr("Network error.");
  }
  setScanBusy(false);
}

async function confirmScanPayment() {
  if (!scanSale) return;

  setScanBusy(true);
  setScanErr(null);
  try {
    const res = await fetch("/api/scan/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: scanSale.public_code }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) { setScanErr(json?.error || `Error ${res.status}`); setScanBusy(false); return; }

    setToast({ type: "ok", text: `Scan sale confirmed — ${scanSale.public_code}` });
    setCodeOpen(false);
    setScanSale(null);
    setScanCode("");
  } catch {
    setScanErr("Network error.");
  }
  setScanBusy(false);
}

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("products")
        .select("id,name,price,sku")
        .eq("is_active", true)
        .order("name");
      setProducts((data as any) || []);

      const since = new Date();
      since.setDate(since.getDate() - 30);
      const { data: items } = await supabase
        .from("sale_items")
        .select("product_id,qty")
        .gte("created_at", since.toISOString());
      if (items) {
        const counts: Record<string, number> = {};
        for (const it of items as any[]) {
          counts[it.product_id] = (counts[it.product_id] || 0) + Number(it.qty);
        }
        setTopIds(
          Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 8)
            .map(([id]) => id)
        );
      }
    })();
  }, []);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 3500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const itemCount = useMemo(() => cartItems.reduce((s, it) => s + it.qty, 0), [cartItems]);
  const subtotal = useMemo(() => cartItems.reduce((s, it) => s + it.qty * it.product.price, 0), [cartItems]);

  const categories = useMemo(() => {
    const letters = new Set(products.map(p => p.name[0].toUpperCase()));
    return ["all", "popular", ...Array.from(letters).sort()];
  }, [products]);

  const filtered = useMemo(() => {
    let out = products;
    const n = q.trim().toLowerCase();
    if (n) {
      out = out.filter(p => p.name.toLowerCase().includes(n) || (p.sku || "").toLowerCase().includes(n));
    } else if (activeTab === "popular") {
      out = out.filter(p => topIds.includes(p.id));
    } else if (activeTab !== "all") {
      out = out.filter(p => p.name[0].toUpperCase() === activeTab);
    }
    return out;
  }, [products, q, activeTab, topIds]);

  function add(p: Product) {
    setCart(prev => ({ ...prev, [p.id]: { product: p, qty: (prev[p.id]?.qty || 0) + 1 } }));
  }

  function setQty(id: string, qty: number) {
    setCart(prev => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = { ...next[id], qty };
      return next;
    });
  }

  function removeItem(id: string) {
    setCart((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

async function checkout() {
  if (!cartItems.length) return;

  setBusy(true);
  try {
    const res = await fetch("/api/pos/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        payment_method: payMethod,
        momo_reference: payMethod === "MOMO" ? momoRef.trim() || null : null,
        items: cartItems.map((it) => ({ product_id: it.product.id, qty: it.qty })),
      }),
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      setBusy(false);
      setToast({ type: "err", text: json?.error || `Error ${res.status}` });
      return;
    }

    setBusy(false);
    setCart({});
    setCartOpen(false);
    setMomoRef("");
    setPayMethod("CASH");
    setToast({ type: "ok", text: `Sale recorded — ${String(json.code || "")}` });
  } catch {
    setBusy(false);
    setToast({ type: "err", text: "Network error." });
  }
}

  return (
    // KEY FIX: use min-h-screen + bg-white instead of h-full overflow-hidden
    <div
      className="min-h-screen bg-white"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Sticky top bar */}
      <div className="sticky top-0 z-20 bg-white border-b border-slate-100">
        <div className="px-5 pt-5 pb-0">
          {/* Title row */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">Point of Sale</p>
              <h1 className="text-xl font-bold text-slate-900">New transaction</h1>
            </div>
            <button
            onClick={() => {
              setCodeOpen(true);
              setScanErr(null);
              setScanSale(null);
              setScanCode("");
              setTimeout(() => codeRef.current?.focus(), 80);
            }}
            className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M4 2.5H10C11.1046 2.5 12 3.39543 12 4.5V9.5C12 10.6046 11.1046 11.5 10 11.5H4C2.89543 11.5 2 10.6046 2 9.5V4.5C2 3.39543 2.89543 2.5 4 2.5Z" stroke="currentColor" strokeWidth="1.3" />
              <path d="M4 5.2H10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
              <path d="M4 8.8H8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            Code
          </button>
            <button
              onClick={() => setCartOpen(v => !v)}
              className="relative flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-all shadow-sm"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 2H4L5.5 10H11.5L13 5H5.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="7" cy="12" r="1.2" fill="currentColor"/>
                <circle cx="11" cy="12" r="1.2" fill="currentColor"/>
              </svg>
              Cart
              {itemCount > 0 && (
                <span className="h-5 w-5 rounded-full bg-[#c0392b] text-white text-[9px] font-bold flex items-center justify-center">
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              )}
            </button>
          </div>

          {/* Search + tabs */}
          <div className="flex items-center gap-3 pb-3">
            <div className="relative w-52 flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                <path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              </svg>
              <input
                ref={searchRef}
                className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 transition-all"
                placeholder="Search products…"
                value={q}
                onChange={e => { setQ(e.target.value); if (e.target.value) setActiveTab("all"); }}
              />
            </div>
            <div
              className="flex items-center gap-1.5 overflow-x-auto flex-1"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              {categories.slice(0, 14).map(c => (
                <button
                  key={c}
                  onClick={() => { setActiveTab(c); setQ(""); }}
                  className={[
                    "flex-shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition-all whitespace-nowrap",
                    activeTab === c && !q
                      ? "bg-slate-900 text-white"
                      : "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
                  ].join(" ")}
                >
                  {c === "all" ? "All" : c === "popular" ? "⭐ Popular" : c}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Product grid */}
      <div className="px-5 py-5">
        {products.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-4">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M3 5L11 2L19 5V17L11 20L3 17V5Z" stroke="#d1d5db" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="M11 2V20M3 5L11 8L19 5" stroke="#d1d5db" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </div>
            <p className="text-sm font-semibold text-slate-400">No products available</p>
            <p className="text-xs text-slate-300 mt-1">Add products in the Products section</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 text-center">
            <p className="text-sm font-semibold text-slate-400">Nothing found</p>
            <p className="text-xs text-slate-300 mt-1">Try a different search</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {filtered.map((p, i) => {
              const inCart = cart[p.id]?.qty || 0;
              const pal = palette(p.name);
              const isTop = topIds.includes(p.id);

              return (
                <motion.button
                  key={p.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.018, 0.25), duration: 0.18 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => add(p)}
                  className={[
                    "relative rounded-2xl p-4 text-left transition-all duration-200 select-none border",
                    inCart > 0
                      ? "border-[#c0392b]/20 ring-1 ring-[#c0392b]/15 shadow-sm"
                      : "border-slate-100 hover:border-slate-200 hover:shadow-sm",
                  ].join(" ")}
                  style={{
                    background: inCart > 0 ? "#FFF0EE" : pal.bg,
                  }}
                >
                  {/* Qty badge */}
                  {inCart > 0 && (
                    <>
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeItem(p.id); }}
                      className="absolute top-2 left-2 h-6 w-6 rounded-lg bg-white/85 hover:bg-white text-slate-500 hover:text-[#c0392b] flex items-center justify-center z-10"
                      aria-label="Remove from cart"
                    >
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 2L8 8M8 2L2 8" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    </button>
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                      className="absolute -top-1.5 -right-1.5 h-5 w-5 rounded-full bg-[#c0392b] text-white text-[9px] font-bold flex items-center justify-center z-10 shadow-sm"
                    >
                      {inCart}
                    </motion.span>
                    </>
                  )}

                  {/* Popular dot */}
                  {isTop && !inCart && (
                    <span
                      className="absolute top-2.5 right-2.5 h-1.5 w-1.5 rounded-full"
                      style={{ background: pal.accent }}
                    />
                  )}

                  {/* Initial avatar */}
                  <div
                    className="h-9 w-9 rounded-xl flex items-center justify-center text-sm font-bold mb-3"
                    style={{ background: pal.accent + "18", color: pal.text }}
                  >
                    {p.name[0].toUpperCase()}
                  </div>

                  <p className="text-xs font-semibold text-slate-800 leading-snug line-clamp-2 mb-1.5">{p.name}</p>
                  <p className="text-[11px] font-bold" style={{ color: pal.text }}>
                    GHS {fmt(p.price)}
                  </p>
                  {p.sku && (
                    <p className="text-[10px] text-slate-400 mt-0.5">{p.sku}</p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Bottom padding */}
        <div className="h-8" />
      </div>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            key="toast"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            transition={{ duration: 0.22 }}
            className={[
              "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 rounded-2xl px-5 py-3 text-[13px] font-semibold shadow-2xl whitespace-nowrap",
              toast.type === "ok" ? "bg-slate-900 text-white" : "bg-[#c0392b] text-white",
            ].join(" ")}
          >
            {toast.type === "ok"
              ? <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M4 6.5L5.5 8L9 4.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              : <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4V6.5M6.5 9H6.51" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
            }
            {toast.text}
          </motion.div>
        )}
      </AnimatePresence>

        <AnimatePresence>
  {codeOpen && (
    <motion.div
      key="code-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.16 }}
      style={{ background: "rgba(0,0,0,0.35)", backdropFilter: "blur(8px)" }}
      onClick={() => setCodeOpen(false)}
    >
      <motion.div
        onClick={(e) => e.stopPropagation()}
        initial={{ opacity: 0, y: 10, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 10, scale: 0.98 }}
        transition={{ type: "spring", stiffness: 420, damping: 34 }}
        className="w-full max-w-[520px] rounded-3xl bg-white border border-slate-100 shadow-[0_24px_90px_rgba(0,0,0,0.25)] overflow-hidden"
        style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 flex items-start justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-widest mb-0.5">
              Scan Checkout
            </p>
            <h3 className="text-lg font-bold text-slate-900">Redeem receipt code</h3>
            <p className="text-xs text-slate-400 mt-1">
              Enter the customer’s 6-digit code to load items and confirm payment.
            </p>
          </div>
          <button
            onClick={() => setCodeOpen(false)}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
            aria-label="Close"
          >
            <svg width="12" height="12" viewBox="0 0 11 11" fill="none">
              <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {/* Input row */}
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <input
                ref={codeRef}
                value={scanCode}
                onChange={(e) => {
                  setScanCode(e.target.value);
                  setScanErr(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") lookupScanCode();
                }}
                placeholder="Enter code (e.g. 483291)"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#c0392b]/15 focus:border-[#c0392b]/30 transition-all"
                inputMode="numeric"
              />
            </div>

            <button
              disabled={scanBusy}
              onClick={lookupScanCode}
              className="rounded-2xl bg-slate-900 text-white px-4 py-3 text-sm font-bold hover:bg-slate-800 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {scanBusy ? (
                <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
              ) : (
                <>
                  Lookup
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                    <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </>
              )}
            </button>
          </div>

          {/* Error */}
          <AnimatePresence>
            {scanErr && (
              <motion.div
                key="scan-err"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="rounded-2xl bg-[#FFF0EE] border border-[#c0392b]/15 px-4 py-3 text-sm text-[#c0392b] flex items-start justify-between gap-2"
              >
                <span>{scanErr}</span>
                <button onClick={() => setScanErr(null)} className="opacity-60 hover:opacity-100">
                  <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                    <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Sale preview */}
          {scanSale && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.18 }}
              className="rounded-3xl border border-slate-100 bg-white overflow-hidden"
            >
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    Code <span className="font-black text-slate-900 tracking-widest">{scanSale.public_code}</span>
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {scanCount} item{scanCount !== 1 ? "s" : ""} · Method: {scanSale.payment_method || "—"}
                    {scanSale.momo_reference ? ` · Ref: ${scanSale.momo_reference}` : ""}
                  </p>
                </div>

                <div className="text-right">
                  <p className="text-[10px] text-slate-400">Total</p>
                  <p className="text-xl font-black text-slate-900">{money(scanTotal)}</p>
                </div>
              </div>

              <div className="max-h-[260px] overflow-y-auto p-3 space-y-2">
                {(scanSale.sale_items || []).map((it) => (
                  <div
                    key={it.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-slate-50/60 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {it.products?.name || "Unknown product"}
                      </p>
                      <p className="text-[11px] text-slate-400">
                        {money(Number(it.unit_price_at_time || 0))} ea.
                        {it.products?.sku ? ` · ${it.products.sku}` : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="rounded-xl bg-white border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-700">
                        x{it.qty}
                      </span>
                      <span className="text-sm font-black text-slate-900 min-w-[92px] text-right">
                        {money(Number(it.line_total || 0))}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Footer actions */}
              <div className="px-5 py-4 border-t border-slate-100 flex items-center justify-between gap-3">
                <div className="text-[11px] text-slate-400">
                  Status: <span className="font-semibold text-slate-600">{scanSale.status}</span> · Payment:{" "}
                  <span className="font-semibold text-slate-600">{scanSale.payment_status}</span>
                </div>

                <button
                  disabled={scanBusy}
                  onClick={confirmScanPayment}
                  className="rounded-2xl bg-[#c0392b] text-white px-5 py-3 text-sm font-bold hover:bg-[#a93226] transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {scanBusy ? (
                    <span className="h-4 w-4 rounded-full border-2 border-white/25 border-t-white animate-spin" />
                  ) : (
                    <>
                      Confirm payment
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          )}

          {!scanSale && !scanErr && (
            <div className="rounded-3xl border border-slate-100 bg-slate-50/60 p-6 text-center">
              <div className="mx-auto h-14 w-14 rounded-2xl bg-[#FFF0EE] border border-[#c0392b]/15 flex items-center justify-center mb-3">
                <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                  <path d="M4 6.5H18" stroke="#c0392b" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M6 11H16" stroke="#c0392b" strokeWidth="1.6" strokeLinecap="round"/>
                  <path d="M8 15.5H14" stroke="#c0392b" strokeWidth="1.6" strokeLinecap="round"/>
                </svg>
              </div>
              <p className="text-sm font-semibold text-slate-600">Waiting for a code</p>
              <p className="text-xs text-slate-400 mt-1">
                Type the customer’s receipt code and hit lookup.
              </p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )}
</AnimatePresence>

      {/* Cart drawer */}
      <AnimatePresence>
        {cartOpen && (
          <motion.div
            key="cart-backdrop"
            className="fixed inset-0 z-40"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ background: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
            onClick={() => setCartOpen(false)}
          >
            <motion.div
              onClick={e => e.stopPropagation()}
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 36 }}
              className="absolute right-0 top-0 h-full w-full sm:w-[380px] bg-white border-l border-slate-100 flex flex-col"
              style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
            >
              {/* Cart header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
                <div>
                  <p className="text-sm font-bold text-slate-900">Cart</p>
                  <p className="text-xs text-slate-400">{itemCount} item{itemCount !== 1 ? "s" : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  {cartItems.length > 0 && (
                    <button
                      onClick={() => setCart({})}
                      className="text-[11px] font-semibold text-slate-400 hover:text-[#c0392b] transition-colors"
                    >
                      Clear all
                    </button>
                  )}
                  <button
                    onClick={() => setCartOpen(false)}
                    className="h-7 w-7 rounded-lg flex items-center justify-center text-slate-400 hover:bg-slate-100 transition-all"
                  >
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none">
                      <path d="M1.5 1.5L9.5 9.5M9.5 1.5L1.5 9.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
                    </svg>
                  </button>
                </div>
              </div>

              {/* Items list */}
              <div className="flex-1 overflow-y-auto px-4 py-3">
                {cartItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center py-16">
                    <div className="h-14 w-14 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center mb-3">
                      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                        <path d="M3 3H6L7.5 14H16.5L18.5 7H8" stroke="#d1d5db" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        <circle cx="10" cy="18" r="2" fill="#d1d5db"/>
                        <circle cx="15" cy="18" r="2" fill="#d1d5db"/>
                      </svg>
                    </div>
                    <p className="text-sm font-semibold text-slate-400">Cart is empty</p>
                    <p className="text-xs text-slate-300 mt-1">Tap a product to add it</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence>
                      {cartItems.map(it => (
                        <motion.div
                          key={it.product.id}
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.18 }}
                          className="overflow-hidden"
                        >
                          <div className="relative group">
                            <div className="absolute inset-y-0 right-0 flex items-center pr-2 md:pr-0">
                              <button
                                onClick={() => removeItem(it.product.id)}
                                className="h-8 w-8 rounded-lg bg-[#c0392b] text-white flex items-center justify-center md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                                aria-label="Delete item"
                              >
                                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><path d="M2 2L9 9M9 2L2 9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
                              </button>
                            </div>
                            <motion.div
                              drag="x"
                              dragConstraints={{ left: -92, right: 0 }}
                              dragElastic={0.08}
                              onDragEnd={(_, info) => { if (info.offset.x < -72) removeItem(it.product.id); }}
                              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-3 relative z-[1]"
                            >
                              {/* Color dot */}
                              <div
                                className="h-8 w-8 rounded-lg flex-shrink-0 flex items-center justify-center text-xs font-bold"
                                style={{
                                  background: palette(it.product.name).accent + "18",
                                  color: palette(it.product.name).text,
                                }}
                              >
                                {it.product.name[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-800 truncate">{it.product.name}</p>
                                <p className="text-[10px] text-slate-400">GHS {fmt(it.product.price)} ea.</p>
                                <p className="text-[10px] text-slate-300 md:hidden">Swipe left to remove</p>
                              </div>
                              <div className="flex items-center gap-2 flex-shrink-0">
                                <div className="flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden">
                                  <button
                                    onClick={() => setQty(it.product.id, it.qty - 1)}
                                    className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-[#c0392b] hover:bg-[#c0392b]/5 transition-all text-sm font-bold"
                                  >
                                    −
                                  </button>
                                  <span className="px-2 text-[11px] font-bold text-slate-800 min-w-[20px] text-center">{it.qty}</span>
                                  <button
                                    onClick={() => setQty(it.product.id, it.qty + 1)}
                                    className="h-6 w-6 flex items-center justify-center text-slate-400 hover:text-[#c0392b] hover:bg-[#c0392b]/5 transition-all text-sm font-bold"
                                  >
                                    +
                                  </button>
                                </div>
                                <p className="text-xs font-bold text-slate-800 min-w-[64px] text-right">GHS {fmt(it.qty * it.product.price)}</p>
                              </div>
                            </motion.div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </div>

              {/* Checkout panel */}
              {cartItems.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-5 space-y-4 flex-shrink-0 bg-white">
                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400 font-medium">Subtotal ({itemCount} items)</p>
                    <p className="text-xl font-bold text-slate-900">GHS {fmt(subtotal)}</p>
                  </div>

                  {/* Payment */}
                  <div className="grid grid-cols-2 gap-2">
                    {(["CASH", "MOMO"] as const).map(m => (
                      <button
                        key={m}
                        onClick={() => setPayMethod(m)}
                        className={[
                          "rounded-xl py-2.5 text-xs font-bold border transition-all",
                          payMethod === m
                            ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                            : "bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50",
                        ].join(" ")}
                      >
                        {m === "CASH" ? "Cash" : "Mobile Money"}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {payMethod === "MOMO" && (
                      <motion.div
                        key="momo-ref"
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <input
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white px-3.5 py-2.5 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#c0392b]/15 focus:border-[#c0392b]/30 transition-all"
                          placeholder="MoMo reference (optional)"
                          value={momoRef}
                          onChange={e => setMomoRef(e.target.value)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <button
                    disabled={busy}
                    onClick={checkout}
                    className="w-full rounded-xl bg-[#c0392b] py-3.5 text-sm font-bold text-white hover:bg-[#a93226] transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm"
                  >
                    {busy ? (
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    ) : (
                      <>
                        Confirm sale · {money(subtotal)}
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                          <path d="M4.5 2L8.5 6L4.5 10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </>
                    )}
                  </button>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}