"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Product = { id: string; name: string; price: number; sku: string | null };

type ProductStats = Product & {
  sold_7d: number;
  sold_30d: number;
  daily_rate: number; // units/day (30-day avg)
  weekly_rate: number; // units/week
  urgency: "critical" | "warning" | "low";
  trend: "rising" | "falling" | "stable";
  restock_qty: number; // suggested qty to restock (2-week supply)
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function round1(n: number) { return Math.round(n * 10) / 10; }

const URGENCY = {
  critical: {
    label: "High demand",
    short: "Critical",
    dot: "bg-[#c0392b]",
    badge: "bg-[#FFF0EE] text-[#c0392b] border border-[#c0392b]/20",
    bar: "#c0392b",
    barBg: "#FFF0EE",
    iconClass: "bg-[#c0392b]",
  },
  warning: {
    label: "Moderate demand",
    short: "Moderate",
    dot: "bg-amber-500",
    badge: "bg-amber-50 text-amber-700 border border-amber-200",
    bar: "#D97706",
    barBg: "#FFFBEB",
    iconClass: "bg-amber-500",
  },
  low: {
    label: "Low demand",
    short: "Low",
    dot: "bg-slate-300",
    badge: "bg-slate-100 text-slate-500",
    bar: "#CBD5E1",
    barBg: "#F8FAFC",
    iconClass: "bg-slate-300",
  },
};

type Tab = "overview" | "market-list";
type Filter = "all" | "critical" | "warning";
type Sort = "demand" | "name" | "sold_7d" | "sold_30d";

export default function InventoryPage() {
  const supabase = supabaseBrowser();
  const [stats, setStats] = useState<ProductStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<Sort>("demand");
  const [tab, setTab] = useState<Tab>("overview");
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const now = new Date();
      const d30 = new Date(now.getTime() - 30 * 86400000);
      const d7 = new Date(now.getTime() - 7 * 86400000);

      const [{ data: products }, { data: rawItems }] = await Promise.all([
        supabase.from("products").select("id,name,price,sku").eq("is_active", true),
        supabase
          .from("sale_items")
          .select("product_id,qty,created_at")
          .gte("created_at", d30.toISOString()),
      ]);

      if (!products) { setLoading(false); return; }

      const items = (rawItems || []) as { product_id: string; qty: number; created_at: string }[];

      const combined: ProductStats[] = (products as Product[]).map(p => {
        const all30 = items.filter(i => i.product_id === p.id);
        const all7 = all30.filter(i => new Date(i.created_at) >= d7);
        const sold30 = all30.reduce((s, i) => s + Number(i.qty), 0);
        const sold7 = all7.reduce((s, i) => s + Number(i.qty), 0);
        const dailyRate = sold30 / 30;
        const weeklyRate = sold7;

        // Urgency: based on daily average rate
        const urgency: ProductStats["urgency"] =
          dailyRate >= 3 ? "critical" : dailyRate >= 0.5 ? "warning" : "low";

        // Trend: compare last 7d vs expected 7d
        const expected7 = dailyRate * 7;
        const trend: ProductStats["trend"] =
          sold7 > expected7 * 1.25 ? "rising" :
          sold7 < expected7 * 0.75 ? "falling" :
          "stable";

        // Restock suggestion: 2-week supply at current daily rate
        const restock_qty = Math.max(1, Math.ceil(dailyRate * 14));

        return {
          ...p,
          sold_7d: sold7,
          sold_30d: sold30,
          daily_rate: dailyRate,
          weekly_rate: weeklyRate,
          urgency,
          trend,
          restock_qty,
        };
      });

      setStats(combined);
      setLoading(false);
    })();
  }, []);

  // Max rate for bar scaling
  const maxRate = useMemo(
    () => Math.max(...stats.map(s => s.daily_rate), 1),
    [stats]
  );

  // Sorted + filtered
  const displayed = useMemo(() => {
    let out = stats;
    const n = q.trim().toLowerCase();
    if (n) out = out.filter(p => p.name.toLowerCase().includes(n) || (p.sku || "").toLowerCase().includes(n));
    if (filter !== "all") out = out.filter(p => p.urgency === filter);

    return [...out].sort((a, b) => {
      if (sort === "demand") {
        const order = { critical: 0, warning: 1, low: 2 };
        return order[a.urgency] !== order[b.urgency]
          ? order[a.urgency] - order[b.urgency]
          : b.daily_rate - a.daily_rate;
      }
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "sold_7d") return b.sold_7d - a.sold_7d;
      if (sort === "sold_30d") return b.sold_30d - a.sold_30d;
      return 0;
    });
  }, [stats, q, filter, sort]);

  // Market list = critical + warning items, sorted by demand desc
  const marketList = useMemo(
    () =>
      stats
        .filter(s => s.urgency !== "low" || checkedIds.has(s.id))
        .sort((a, b) => {
          const order = { critical: 0, warning: 1, low: 2 };
          return order[a.urgency] - order[b.urgency];
        }),
    [stats, checkedIds]
  );

  const criticalCount = stats.filter(s => s.urgency === "critical").length;
  const warningCount = stats.filter(s => s.urgency === "warning").length;
  const totalRestockValue = marketList
    .filter(s => !checkedIds.has(s.id))
    .reduce((sum, s) => sum + s.restock_qty * s.price, 0);

  function toggleCheck(id: string) {
    setCheckedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div
      className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-5"
      style={{ fontFamily: "'DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400 mb-1">
            <span>Admin</span><span className="text-slate-200">/</span>
            <span className="text-slate-500 font-medium">Inventory</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Inventory Intelligence</h1>
          <p className="text-sm text-slate-400 mt-0.5">Demand analysis based on actual sales data.</p>
        </div>

        {/* Alert pills */}
        {!loading && (
          <div className="flex items-center gap-2 flex-wrap">
            {criticalCount > 0 && (
              <button
                onClick={() => { setTab("market-list"); }}
                className="flex items-center gap-1.5 rounded-xl bg-[#FFF0EE] border border-[#c0392b]/15 px-3.5 py-2 text-xs font-bold text-[#c0392b] hover:bg-[#FFE8E5] transition-all"
              >
                <span className="h-1.5 w-1.5 rounded-full bg-[#c0392b] animate-pulse" />
                {criticalCount} high demand
              </button>
            )}
            {warningCount > 0 && (
              <div className="flex items-center gap-1.5 rounded-xl bg-amber-50 border border-amber-200 px-3.5 py-2 text-xs font-bold text-amber-700">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {warningCount} moderate
              </div>
            )}
          </div>
        )}
      </motion.div>

      {/* Tab bar */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.2 }}
        className="flex items-center gap-1 bg-slate-100/60 rounded-xl p-1 w-fit"
      >
        {([
          { key: "overview", label: "Overview" },
          { key: "market-list", label: `Market List${marketList.length > 0 ? ` (${marketList.length})` : ""}` },
        ] as { key: Tab; label: string }[]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={[
              "rounded-lg px-4 py-2 text-xs font-bold transition-all",
              tab === t.key
                ? "bg-white text-slate-900 shadow-sm"
                : "text-slate-500 hover:text-slate-700",
            ].join(" ")}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      <AnimatePresence mode="wait">
        {tab === "overview" ? (
          <motion.div
            key="overview"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Stats strip */}
            {!loading && (
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "High Demand", value: criticalCount, color: "#c0392b", bg: "#FFF0EE" },
                  { label: "Moderate Demand", value: warningCount, color: "#D97706", bg: "#FFFBEB" },
                  { label: "Low Demand", value: stats.filter(s => s.urgency === "low").length, color: "#94A3B8", bg: "#F8FAFC" },
                ].map((s, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="rounded-2xl border border-slate-100 p-4 shadow-sm bg-white"
                  >
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5">{s.label}</div>
                    <div className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</div>
                    <div className="text-[10px] text-slate-400 mt-0.5">products</div>
                  </motion.div>
                ))}
              </div>
            )}

            {/* Filter + sort bar */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                {/* Search */}
                <div className="relative flex-1">
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                    <circle cx="5" cy="5" r="3.5" stroke="currentColor" strokeWidth="1.2"/>
                    <path d="M8.5 8.5L10.5 10.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                  </svg>
                  <input
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 focus:bg-white pl-8 pr-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 transition-all"
                    placeholder="Search products…"
                    value={q}
                    onChange={e => setQ(e.target.value)}
                  />
                </div>

                {/* Filter buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  {([
                    { key: "all", label: "All" },
                    { key: "critical", label: "High" },
                    { key: "warning", label: "Moderate" },
                  ] as { key: Filter; label: string }[]).map(f => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={[
                        "rounded-xl px-3 py-2 text-[11px] font-semibold transition-all",
                        filter === f.key
                          ? "bg-slate-800 text-white shadow-sm"
                          : "bg-slate-50 border border-slate-100 text-slate-500 hover:bg-slate-100",
                      ].join(" ")}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                {/* Sort */}
                <div className="relative">
                  <select
                    value={sort}
                    onChange={e => setSort(e.target.value as Sort)}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-[#c0392b]/12 appearance-none pr-8 cursor-pointer"
                  >
                    <option value="demand">Sort: Demand</option>
                    <option value="name">Sort: Name</option>
                    <option value="sold_7d">Sort: Last 7 days</option>
                    <option value="sold_30d">Sort: Last 30 days</option>
                  </select>
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                    <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
            </div>

            {/* Product table */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
              {/* Column headers */}
              <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-2.5 bg-slate-50/60 border-b border-slate-50">
                <div className="col-span-3 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Product</div>
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Demand</div>
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sold (7d)</div>
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Sold (30d)</div>
                <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily avg</div>
                <div className="col-span-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Trend</div>
              </div>

              {loading ? (
                <div className="p-5 space-y-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="h-14 rounded-xl bg-slate-50 animate-pulse" style={{ animationDelay: `${i * 0.06}s` }} />
                  ))}
                </div>
              ) : displayed.length === 0 ? (
                <div className="p-10 text-center">
                  <p className="text-sm font-semibold text-slate-400">No products found</p>
                </div>
              ) : (
                displayed.map((p, i) => {
                  const urg = URGENCY[p.urgency];
                  const barWidth = maxRate > 0 ? (p.daily_rate / maxRate) * 100 : 0;
                  return (
                    <motion.div
                      key={p.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                    >
                      {/* Desktop row */}
                      <div className="hidden sm:grid grid-cols-12 gap-4 items-center px-5 py-3.5 border-b border-slate-50 hover:bg-slate-50/60 transition-colors">
                        <div className="col-span-3 min-w-0">
                          <div className="text-xs font-semibold text-slate-800 truncate">{p.name}</div>
                          {p.sku && <div className="text-[10px] text-slate-400 truncate">{p.sku}</div>}
                        </div>
                        <div className="col-span-2">
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold ${urg.badge}`}>
                              {urg.short}
                            </span>
                          </div>
                          {/* Demand bar */}
                          <div className="h-1 rounded-full bg-slate-100 overflow-hidden w-full">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: i * 0.02 + 0.3 }}
                              className="h-full rounded-full"
                              style={{ background: urg.bar }}
                            />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm font-bold text-slate-800">{p.sold_7d}</div>
                          <div className="text-[10px] text-slate-400">units</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-sm font-bold text-slate-800">{p.sold_30d}</div>
                          <div className="text-[10px] text-slate-400">units</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-xs font-semibold text-slate-700">{round1(p.daily_rate)}/day</div>
                          <div className="text-[10px] text-slate-400">{round1(p.daily_rate * 7)}/wk est.</div>
                        </div>
                        <div className="col-span-1">
                          <span className={[
                            "inline-flex items-center gap-1 text-[10px] font-semibold",
                            p.trend === "rising" ? "text-emerald-600" :
                            p.trend === "falling" ? "text-[#c0392b]" : "text-slate-400",
                          ].join(" ")}>
                            {p.trend === "rising" ? "↑" : p.trend === "falling" ? "↓" : "→"}
                            {p.trend}
                          </span>
                        </div>
                      </div>

                      {/* Mobile card */}
                      <div className="sm:hidden px-4 py-3.5 border-b border-slate-50">
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-semibold text-slate-800 truncate">{p.name}</div>
                            {p.sku && <div className="text-[10px] text-slate-400">{p.sku}</div>}
                          </div>
                          <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold flex-shrink-0 ${urg.badge}`}>
                            {urg.short}
                          </span>
                        </div>
                        <div className="flex items-center gap-4 text-[11px] text-slate-500 mb-1.5">
                          <span><strong className="text-slate-700">{p.sold_7d}</strong> last 7d</span>
                          <span><strong className="text-slate-700">{p.sold_30d}</strong> last 30d</span>
                          <span><strong className="text-slate-700">{round1(p.daily_rate)}</strong>/day</span>
                        </div>
                        <div className="h-1 rounded-full bg-slate-100 overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${barWidth}%`, background: urg.bar }} />
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>

            <p className="text-[10px] text-slate-300 text-center px-4">
              Demand tiers: High ≥ 3 units/day · Moderate ≥ 0.5/day · Low &lt; 0.5/day · Based on last 30 days of sales data
            </p>
          </motion.div>
        ) : (
          /* ── MARKET LIST TAB ── */
          <motion.div
            key="market-list"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="space-y-4"
          >
            {/* Hero card */}
            <div className="rounded-2xl bg-gradient-to-br from-[#c0392b] to-[#922b21] p-5 text-white shadow-[0_6px_24px_rgba(192,57,43,0.3)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold text-red-200 uppercase tracking-wider mb-1">Market List</div>
                  <h2 className="text-lg font-bold mb-0.5">Restock Needed</h2>
                  <p className="text-sm text-red-100">
                    {marketList.length} products to restock · estimated{" "}
                    <strong className="text-white">GHS {fmt(totalRestockValue)}</strong> budget
                  </p>
                  <p className="text-xs text-red-200 mt-1">
                    Quantities are 2-week supply at current demand rate.
                  </p>
                </div>
                <div className="flex-shrink-0 h-12 w-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
                    <path d="M6.8 8.5H15.2L14.4 17.6H7.6L6.8 8.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M8.4 8.4V6.9C8.4 5.5 9.6 4.3 11 4.3C12.4 4.3 13.6 5.5 13.6 6.9V8.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
                  </svg>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3 flex-wrap">
                <button
                  onClick={() => {
                    const lines = marketList
                      .filter(s => !checkedIds.has(s.id))
                      .map(s => `${s.name} — ${s.restock_qty} units (${URGENCY[s.urgency].short})`)
                      .join("\n");
                    navigator.clipboard?.writeText(lines).catch(() => {});
                    alert("Market list copied to clipboard!");
                  }}
                  className="flex items-center gap-1.5 rounded-xl bg-white/20 hover:bg-white/30 px-3.5 py-2 text-xs font-semibold transition-all"
                >
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><rect x="1" y="3" width="8" height="9" rx="1.2" stroke="currentColor" strokeWidth="1.2"/><path d="M3 3V2C3 1.448 3.448 1 4 1H11C11.552 1 12 1.448 12 2V9C12 9.552 11.552 10 11 10H10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                  Copy list
                </button>
                <button
                  onClick={() => setCheckedIds(new Set())}
                  className="rounded-xl bg-white/15 hover:bg-white/25 px-3.5 py-2 text-xs font-semibold transition-all"
                >
                  Reset ticks
                </button>
              </div>
            </div>

            {/* Items */}
            {loading ? (
              <div className="space-y-2.5">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="h-16 rounded-2xl bg-slate-50 animate-pulse" style={{ animationDelay: `${i * 0.06}s` }} />
                ))}
              </div>
            ) : marketList.length === 0 ? (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-12 text-center">
                <div className="mb-3 flex justify-center text-emerald-600"><svg width="28" height="28" viewBox="0 0 20 20" fill="none" aria-hidden="true"><circle cx="10" cy="10" r="8.4" stroke="currentColor" strokeWidth="1.4"/><path d="M6.3 10.2L8.8 12.7L13.8 7.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg></div>
                <p className="text-sm font-bold text-slate-700">All products are in good shape</p>
                <p className="text-xs text-slate-400 mt-1">No items currently flagged for restock based on sales data.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                {/* Header */}
                <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-2.5 bg-slate-50/60 border-b border-slate-50">
                  <div className="col-span-1" />
                  <div className="col-span-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Product</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Demand</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Daily avg</div>
                  <div className="col-span-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Suggest qty</div>
                  <div className="col-span-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Est. cost</div>
                </div>

                <AnimatePresence>
                  {marketList.map((p, i) => {
                    const urg = URGENCY[p.urgency];
                    const done = checkedIds.has(p.id);
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: done ? 0.45 : 1 }}
                        transition={{ duration: 0.18, delay: i * 0.025 }}
                      >
                        {/* Desktop row */}
                        <div
                          className={[
                            "hidden sm:grid grid-cols-12 gap-4 items-center px-5 py-3.5 border-b border-slate-50 transition-colors",
                            done ? "bg-slate-50/60" : "hover:bg-slate-50/40",
                          ].join(" ")}
                        >
                          {/* Checkbox */}
                          <div className="col-span-1">
                            <button
                              onClick={() => toggleCheck(p.id)}
                              className={[
                                "h-5 w-5 rounded-md border-2 flex items-center justify-center transition-all",
                                done
                                  ? "bg-emerald-500 border-emerald-500"
                                  : "border-slate-300 hover:border-slate-500",
                              ].join(" ")}
                            >
                              {done && (
                                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </button>
                          </div>
                          <div className="col-span-4 min-w-0">
                            <div className={["text-sm font-semibold truncate", done ? "line-through text-slate-400" : "text-slate-800"].join(" ")}>
                              {p.name}
                            </div>
                            {p.sku && <div className="text-[10px] text-slate-400">{p.sku}</div>}
                          </div>
                          <div className="col-span-2">
                            <span className={`inline-flex rounded-lg px-2 py-0.5 text-[10px] font-semibold ${urg.badge}`}>
                              {urg.label}
                            </span>
                          </div>
                          <div className="col-span-2">
                            <div className="text-xs font-semibold text-slate-700">{round1(p.daily_rate)}/day</div>
                            <div className="text-[10px] text-slate-400">{p.sold_30d} sold in 30d</div>
                          </div>
                          <div className="col-span-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-sm font-bold text-slate-900">{p.restock_qty}</span>
                              <span className="text-[10px] text-slate-400">units (2 wks)</span>
                            </div>
                          </div>
                          <div className="col-span-1">
                            <div className="text-xs font-bold text-slate-700">GHS {fmt(p.restock_qty * p.price)}</div>
                          </div>
                        </div>

                        {/* Mobile card */}
                        <div
                          className={["sm:hidden px-4 py-3.5 border-b border-slate-50 flex items-center gap-3", done ? "bg-slate-50/60" : ""].join(" ")}
                        >
                          <button
                            onClick={() => toggleCheck(p.id)}
                            className={[
                              "h-5 w-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-all",
                              done ? "bg-emerald-500 border-emerald-500" : "border-slate-300",
                            ].join(" ")}
                          >
                            {done && (
                              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                                <path d="M2 5L4 7L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            )}
                          </button>
                          <div className="flex-1 min-w-0">
                            <div className={["text-sm font-semibold truncate", done ? "line-through text-slate-400" : "text-slate-800"].join(" ")}>
                              {p.name}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <span className={`inline-flex rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${urg.badge}`}>
                                {urg.short}
                              </span>
                              <span className="text-[11px] text-slate-500">{round1(p.daily_rate)}/day avg</span>
                            </div>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="text-sm font-bold text-slate-900">{p.restock_qty} units</div>
                            <div className="text-[10px] text-slate-400">GHS {fmt(p.restock_qty * p.price)}</div>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* Total footer */}
                <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-100 flex items-center justify-between flex-wrap gap-3">
                  <div className="text-xs text-slate-500">
                    {checkedIds.size > 0 && (
                      <span className="text-emerald-600 font-semibold">{checkedIds.size} item{checkedIds.size !== 1 ? "s" : ""} checked off · </span>
                    )}
                    {marketList.length - checkedIds.size} remaining
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Est. remaining budget</span>
                    <span className="text-sm font-bold text-slate-900">GHS {fmt(totalRestockValue)}</span>
                  </div>
                </div>
              </div>
            )}

            <p className="text-[10px] text-slate-300 text-center px-4">
              Suggested quantities = 14 days at current daily average. Tick items off as you shop.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}