// app/scan/page.tsx
"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Product = { id: string; name: string; price: number; sku: string | null };
type CartItem = { product: Product; qty: number };

const CODE_KEY = "fw_scan_code_v3";
const RED = "#c0392b";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function money(n: number) {
  return `GHS ${fmt(n)}`;
}
function cx(...a: Array<string | false | null | undefined>) {
  return a.filter(Boolean).join(" ");
}

function Icon({
  name,
  className,
}: {
  name: "search" | "x" | "cart" | "plus" | "minus" | "receipt" | "check" | "clock" | "alert";
  className?: string;
}) {
  const cls = cx("inline-block", className);
  switch (name) {
    case "search":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="7" cy="7" r="4.75" stroke="currentColor" strokeWidth="1.3" />
          <path d="M10.7 10.7L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      );
    case "x":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      );
    case "cart":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M2.2 2.4H4.1L5.2 11.2H12.3L13.8 5.6H5.3"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="7" cy="13.2" r="1.1" fill="currentColor" />
          <circle cx="11.6" cy="13.2" r="1.1" fill="currentColor" />
        </svg>
      );
    case "plus":
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M7 2.3V11.7M2.3 7H11.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "minus":
      return (
        <svg className={cls} width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
          <path d="M2.3 7H11.7" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case "receipt":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path
            d="M5 2.5h6a1 1 0 0 1 1 1V14l-1.2-.8L9.6 14l-1.2-.8L7.2 14 6 13.2 4.8 14V3.5a1 1 0 0 1 1-1Z"
            stroke="currentColor"
            strokeWidth="1.2"
            strokeLinejoin="round"
          />
          <path d="M6.2 6.1h5.6M6.2 8.3h5.6M6.2 10.5h4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      );
    case "check":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M5.6 8.2l1.7 1.7L10.8 6.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "clock":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4.6v3.7l2.4 1.4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "alert":
      return (
        <svg className={cls} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <circle cx="8" cy="8" r="6.2" stroke="currentColor" strokeWidth="1.2" />
          <path d="M8 4.5v4M8 11.4h.01" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
      );
  }
}

function SoftTap({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      whileTap={{ scale: 0.985, filter: "blur(0.18px)" }}
      transition={{ type: "spring", stiffness: 520, damping: 38 }}
    >
      {children}
    </motion.div>
  );
}

function EmptyState({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-10 text-center shadow-sm">
      <div className="mx-auto h-14 w-14 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-500">
        <Icon name="receipt" className="text-slate-500" />
      </div>
      <p className="mt-4 text-sm text-slate-700">{title}</p>
      {subtitle ? <p className="mt-1 text-xs text-slate-400">{subtitle}</p> : null}
    </div>
  );
}

function initials(name: string) {
  const s = (name || "").trim();
  if (!s) return "?";
  return s[0].toUpperCase();
}

function dotColor(name: string) {
  // subtle deterministic color variation (still clean)
  const colors = ["#c0392b", "#2563EB", "#16A34A", "#7C3AED", "#D97706", "#059669"];
  return colors[name.charCodeAt(0) % colors.length];
}

export default function ScanPage() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [q, setQ] = useState("");
  const [cart, setCart] = useState<Record<string, CartItem>>({});
  const [sheetOpen, setSheetOpen] = useState(false);

  const [payMethod, setPayMethod] = useState<"CASH" | "MOMO">("CASH");
  const [momoRef, setMomoRef] = useState("");
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState<string | null>(null);
  const [codeModalOpen, setCodeModalOpen] = useState(false);
  const [saleState, setSaleState] = useState<"pending" | "paid" | "unknown">("unknown");

  const [err, setErr] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  // restore code
  useEffect(() => {
    try {
      const saved = localStorage.getItem(CODE_KEY);
      if (saved) {
        setCode(saved);
        setCodeModalOpen(true);
      }
    } catch {}
  }, []);

  // bootstrap
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/scan/bootstrap");
        const json = await res.json().catch(() => ({}));
        if (!res.ok) {
          setEnabled(false);
          setErr(json?.error || "Unavailable");
          return;
        }
        setEnabled(Boolean(json.enabled));
        setProducts((json.products || []) as Product[]);
      } catch {
        setEnabled(false);
        setErr("Network error.");
      }
    })();
  }, []);

  const cartItems = useMemo(() => Object.values(cart), [cart]);
  const itemCount = useMemo(() => cartItems.reduce((s, it) => s + it.qty, 0), [cartItems]);
  const total = useMemo(() => cartItems.reduce((s, it) => s + it.qty * it.product.price, 0), [cartItems]);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return products;
    return products.filter((p) => p.name.toLowerCase().includes(n) || (p.sku || "").toLowerCase().includes(n));
  }, [products, q]);

  function add(p: Product) {
    setCart((prev) => ({
      ...prev,
      [p.id]: { product: p, qty: (prev[p.id]?.qty || 0) + 1 },
    }));
    setErr(null);
  }

  function setQty(id: string, qty: number) {
    setCart((prev) => {
      const next = { ...prev };
      if (qty <= 0) delete next[id];
      else next[id] = { ...next[id], qty };
      return next;
    });
  }

  function clearCode() {
    setCode(null);
    setSaleState("unknown");
    setCodeModalOpen(false);
    try {
      localStorage.removeItem(CODE_KEY);
    } catch {}
  }

  // Poll status for “paid when staff accepts”
  useEffect(() => {
    if (!code) return;
    let alive = true;

    async function tick() {
      try {
        const res = await fetch(`/api/scan/lookup?code=${encodeURIComponent(code)}`, { cache: "no-store" });
        const json = await res.json().catch(() => ({}));
        if (!alive) return;

        if (!res.ok) {
          setSaleState("unknown");
          return;
        }

        // treat confirmed/paid as PAID
        const raw = String(json.payment_status || json.status || "").toLowerCase();
        if (raw.includes("confirm") || raw.includes("paid")) setSaleState("paid");
        else if (raw.includes("pend") || raw.includes("unpaid")) setSaleState("pending");
        else setSaleState("unknown");
      } catch {
        if (!alive) return;
        setSaleState("unknown");
      }
    }

    tick();
    const t = setInterval(tick, 2500);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [code]);

  async function submit() {
    setErr(null);
    if (!cartItems.length) {
      setErr("Add at least one item.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/scan/create", {
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
        setErr(json?.error || `Error ${res.status}`);
        setBusy(false);
        return;
      }

      const c = String(json.code || "");
      setCode(c);
      setSaleState("pending");
      setCodeModalOpen(true);

      try {
        localStorage.setItem(CODE_KEY, c);
      } catch {}

      setCart({});
      setPayMethod("CASH");
      setMomoRef("");
      setSheetOpen(false);
    } catch {
      setErr("Network error. Please try again.");
    }
    setBusy(false);
  }

  // disabled state
  if (enabled === false) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6" style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
        <div className="w-full max-w-sm rounded-3xl border border-slate-100 bg-white p-8 shadow-sm text-center">
          <div className="mx-auto h-14 w-14 rounded-2xl border border-slate-100 bg-slate-50 flex items-center justify-center text-slate-500">
            <Icon name="alert" className="text-slate-500" />
          </div>
          <p className="mt-4 text-sm text-slate-800">Scan checkout is unavailable</p>
          <p className="mt-1 text-xs text-slate-400">Please pay at the counter.</p>
          {err ? (
            <div className="mt-4 rounded-2xl border px-3 py-2 text-xs" style={{ borderColor: `${RED}25`, background: "#FFF0EE", color: RED }}>
              {err}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}>
      {/* Top bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-100">
        <div className="px-4 sm:px-6 pt-5 pb-4">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500">Fresh Work</p>
              <h1 className="text-[17px] text-slate-900 tracking-tight">Self checkout</h1>
            </div>

            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="relative inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3.5 py-2 text-xs text-slate-700 hover:bg-slate-50 transition"
              aria-label="Open cart"
            >
              <Icon name="cart" className="text-slate-700" />
              Cart
              {itemCount > 0 ? (
                <span
                  className="ml-1 h-5 min-w-[20px] px-1.5 rounded-full text-[10px] text-white flex items-center justify-center"
                  style={{ background: RED }}
                >
                  {itemCount > 99 ? "99+" : itemCount}
                </span>
              ) : null}
            </button>
          </div>

          {/* Search */}
          <div className="mt-4">
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Icon name="search" className="text-slate-400" />
              </span>
              <input
                ref={searchRef}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search products"
                className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white pl-10 pr-10 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 transition"
                style={{ boxShadow: "none" }}
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => setQ("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-2xl hover:bg-slate-100 text-slate-500 transition"
                  aria-label="Clear search"
                >
                  <Icon name="x" className="text-slate-500" />
                </button>
              ) : null}
            </div>

            {err ? (
              <div className="mt-3 rounded-2xl border px-3.5 py-2.5 text-xs flex items-center gap-2" style={{ borderColor: `${RED}25`, background: "#FFF0EE", color: RED }}>
                <Icon name="alert" className="text-[currentColor]" />
                <span className="min-w-0">{err}</span>
                <button type="button" onClick={() => setErr(null)} className="ml-auto opacity-70 hover:opacity-100">
                  <Icon name="x" className="text-[currentColor]" />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Products */}
      <div className="px-4 sm:px-6 py-5">
        {enabled === null ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-[124px] rounded-3xl border border-slate-100 bg-slate-50 animate-pulse" />
            ))}
          </div>
        ) : products.length === 0 ? (
          <EmptyState title="No products available" subtitle="Ask staff to add products." />
        ) : filtered.length === 0 ? (
          <EmptyState title="Nothing found" subtitle="Try a different search." />
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {filtered.map((p, i) => {
              const inCart = cart[p.id]?.qty || 0;
              const accent = dotColor(p.name);

              return (
                <SoftTap key={p.id}>
                  {/* use div role=button to avoid nested button hydration problems */}
                  <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(i * 0.01, 0.18), duration: 0.18 }}
                    role="button"
                    tabIndex={0}
                    onClick={() => add(p)}
                    onKeyDown={(e) => (e.key === "Enter" || e.key === " " ? add(p) : null)}
                    className={cx(
                      "rounded-3xl border bg-white p-4 text-left select-none cursor-pointer transition",
                      inCart > 0 ? "border-slate-200 shadow-sm" : "border-slate-100 hover:border-slate-200 hover:shadow-sm"
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full" style={{ background: accent }} />
                          <p className="text-[12px] text-slate-900 truncate">{p.name}</p>
                        </div>
                        <p className="mt-1 text-[12px] text-slate-600">{money(p.price)}</p>
                        {p.sku ? <p className="mt-0.5 text-[10px] text-slate-400 truncate">{p.sku}</p> : null}
                      </div>

                      {inCart > 0 ? (
                        <span className="h-6 min-w-[24px] px-2 rounded-full text-[11px] text-white flex items-center justify-center" style={{ background: RED }}>
                          {inCart}
                        </span>
                      ) : (
                        <span className="h-9 w-9 rounded-2xl border border-slate-200 bg-white flex items-center justify-center text-slate-700">
                          <Icon name="plus" className="text-slate-700" />
                        </span>
                      )}
                    </div>

                    {/* inline controls when in cart */}
                    {inCart > 0 ? (
                      <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-2 py-1.5" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={() => setQty(p.id, inCart - 1)}
                          className="h-9 w-10 rounded-2xl hover:bg-white transition text-slate-700 flex items-center justify-center"
                          aria-label="Decrease quantity"
                        >
                          <Icon name="minus" className="text-slate-700" />
                        </button>
                        <span className="text-[12px] text-slate-800">{inCart}</span>
                        <button
                          type="button"
                          onClick={() => add(p)}
                          className="h-9 w-10 rounded-2xl hover:bg-white transition text-slate-700 flex items-center justify-center"
                          aria-label="Increase quantity"
                        >
                          <Icon name="plus" className="text-slate-700" />
                        </button>
                      </div>
                    ) : null}
                  </motion.div>
                </SoftTap>
              );
            })}
          </div>
        )}

        <div className="h-24" />
      </div>

      {/* Mobile bottom bar */}
      <AnimatePresence>
        {itemCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 18 }}
            transition={{ type: "spring", stiffness: 420, damping: 34 }}
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-100 bg-white"
            style={{ boxShadow: "0 -10px 30px rgba(0,0,0,0.08)" }}
          >
            <div className="px-4 py-4">
              <button
                type="button"
                onClick={() => setSheetOpen(true)}
                className="w-full rounded-3xl px-5 py-4 text-sm text-white flex items-center justify-between"
                style={{ background: RED }}
              >
                <span className="text-white/95">{itemCount} items</span>
                <span className="flex items-center gap-2 text-white">
                  {money(total)}
                  <Icon name="receipt" className="text-white" />
                </span>
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Cart bottom-sheet */}
      <AnimatePresence>
        {sheetOpen && (
          <motion.div
            className="fixed inset-0 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.34)", backdropFilter: "blur(8px)" }}
            onClick={() => setSheetOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ y: "18%", opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: "18%", opacity: 0 }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="absolute bottom-0 left-0 right-0 bg-white rounded-t-[28px] border-t border-slate-100"
            >
              <div className="px-5 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-900">Cart</p>
                  <p className="text-xs text-slate-400">{itemCount} items</p>
                </div>
                <button type="button" onClick={() => setSheetOpen(false)} className="h-10 w-10 rounded-2xl hover:bg-slate-50 text-slate-600">
                  <Icon name="x" className="text-slate-600" />
                </button>
              </div>

              <div className="max-h-[52vh] overflow-y-auto px-4 py-4">
                {cartItems.length === 0 ? (
                  <EmptyState title="Cart is empty" subtitle="Add items to generate a receipt code." />
                ) : (
                  <div className="space-y-2">
                    {cartItems.map((it) => (
                      <div key={it.product.id} className="rounded-3xl border border-slate-100 bg-slate-50 p-3.5">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[12px] text-slate-900 truncate">{it.product.name}</p>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {it.qty} × {money(it.product.price)}
                            </p>
                          </div>

                          <div className="text-right">
                            <p className="text-[12px] text-slate-900">{money(it.qty * it.product.price)}</p>
                          </div>
                        </div>

                        <div className="mt-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-2 py-1.5">
                          <button
                            type="button"
                            onClick={() => setQty(it.product.id, it.qty - 1)}
                            className="h-9 w-10 rounded-2xl hover:bg-slate-50 transition text-slate-700 flex items-center justify-center"
                            aria-label="Decrease quantity"
                          >
                            <Icon name="minus" className="text-slate-700" />
                          </button>
                          <span className="text-[12px] text-slate-800">{it.qty}</span>
                          <button
                            type="button"
                            onClick={() => setQty(it.product.id, it.qty + 1)}
                            className="h-9 w-10 rounded-2xl hover:bg-slate-50 transition text-slate-700 flex items-center justify-center"
                            aria-label="Increase quantity"
                          >
                            <Icon name="plus" className="text-slate-700" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cartItems.length > 0 && (
                <div className="border-t border-slate-100 px-5 py-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">Total</p>
                    <p className="text-[18px] text-slate-900 tracking-tight">{money(total)}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {(["CASH", "MOMO"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setPayMethod(m)}
                        className={cx(
                          "rounded-2xl py-2.5 text-xs border transition",
                          payMethod === m ? "text-white border-transparent" : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                        )}
                        style={payMethod === m ? { background: RED } : undefined}
                      >
                        {m === "CASH" ? "Cash" : "Mobile Money"}
                      </button>
                    ))}
                  </div>

                  <AnimatePresence>
                    {payMethod === "MOMO" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <input
                          className="w-full h-11 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white px-3.5 text-sm text-slate-900 placeholder-slate-400 outline-none focus:ring-2 transition"
                          placeholder="MoMo reference (optional)"
                          value={momoRef}
                          onChange={(e) => setMomoRef(e.target.value)}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileTap={{ scale: 0.985, filter: "blur(0.18px)" }}
                    transition={{ type: "spring", stiffness: 520, damping: 36 }}
                    disabled={busy}
                    onClick={submit}
                    className="w-full h-12 rounded-3xl text-sm text-white disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    style={{ background: RED }}
                  >
                    {busy ? (
                      <>
                        <span className="h-4 w-4 rounded-full border-2 border-white/35 border-t-white animate-spin" />
                        Generating
                      </>
                    ) : (
                      <>
                        <Icon name="receipt" className="text-white" />
                        Get receipt code
                      </>
                    )}
                  </motion.button>

                  <p className="text-[11px] text-slate-400 text-center">
                    After you generate the code, the cashier will mark it as paid.
                  </p>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Code popup modal (clean) */}
      <AnimatePresence>
        {codeModalOpen && code && (
          <motion.div
            className="fixed inset-0 z-[60] flex items-center justify-center p-5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ background: "rgba(0,0,0,0.34)", backdropFilter: "blur(10px)" }}
            onClick={() => setCodeModalOpen(false)}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ opacity: 0, y: 10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ type: "spring", stiffness: 360, damping: 30 }}
              className="w-full max-w-sm rounded-[28px] border border-slate-100 bg-white shadow-2xl overflow-hidden"
            >
              <div className="px-5 pt-5 pb-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-slate-600">
                      <Icon name="receipt" className="text-slate-600" />
                      <p className="text-[12px] text-slate-700">Receipt code</p>
                    </div>

                    <p className="mt-3 text-[34px] tracking-[0.18em] text-slate-900">{code}</p>

                    <div className="mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[11px]"
                      style={{
                        borderColor: saleState === "paid" ? "rgba(16,185,129,0.25)" : saleState === "pending" ? "rgba(203,213,225,0.8)" : "rgba(148,163,184,0.6)",
                        background: saleState === "paid" ? "rgba(16,185,129,0.08)" : saleState === "pending" ? "rgba(241,245,249,0.7)" : "rgba(241,245,249,0.4)",
                        color: saleState === "paid" ? "#047857" : "#334155",
                      }}
                    >
                      {saleState === "paid" ? <Icon name="check" className="text-[currentColor]" /> : <Icon name="clock" className="text-[currentColor]" />}
                      {saleState === "paid" ? "Paid" : "Pending"}
                    </div>

                    <p className="mt-3 text-xs text-slate-500">
                      Show this code to the cashier. Status updates automatically.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setCodeModalOpen(false)}
                    className="h-10 w-10 rounded-2xl hover:bg-slate-50 text-slate-600 flex items-center justify-center transition"
                    aria-label="Close"
                  >
                    <Icon name="x" className="text-slate-600" />
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 px-5 py-4 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCodeModalOpen(false)}
                  className="flex-1 h-11 rounded-2xl border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition"
                >
                  Done
                </button>
                <button
                  type="button"
                  onClick={clearCode}
                  className="flex-1 h-11 rounded-2xl text-sm text-white transition"
                  style={{ background: RED }}
                >
                  New order
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}