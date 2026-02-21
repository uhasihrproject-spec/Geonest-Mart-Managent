"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Sale = {
  id: string;
  public_code: string;
  created_at: string;
  status: "PAID" | "PENDING" | "CANCELLED";
  payment_method: "CASH" | "MOMO";
  total_amount: number;
  source: "STAFF_MANUAL" | "CUSTOMER_SCAN";
  staff?: { full_name: string | null; username: string } | null;
  sale_items?: { qty: number; unit_price_at_time: number; line_total: number; product?: { name: string } | null }[];
};

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}
function fmtTime(s: string) {
  return new Date(s).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}
function toDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type StatusF = "ALL" | "PAID" | "PENDING" | "CANCELLED";
type PayF = "ALL" | "CASH" | "MOMO";

const STATUS_STYLE: Record<string, string> = {
  PAID: "text-[#16A34A] bg-green-50 border border-green-100",
  PENDING: "text-[#D97706] bg-amber-50 border border-amber-100",
  CANCELLED: "text-[#ABABAB] bg-[#F5F5F5]",
};

export default function SalesPage() {
  const supabase = supabaseBrowser();
  const todayStr = toDate(new Date());

  const [rows, setRows] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [date, setDate] = useState(todayStr);
  const [statusF, setStatusF] = useState<StatusF>("ALL");
  const [payF, setPayF] = useState<PayF>("ALL");
  const [q, setQ] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [savedDates, setSavedDates] = useState<string[]>([]);

  async function load(d: string) {
    setErr(null); setLoading(true); setExpandedId(null);
    const start = new Date(d); start.setHours(0, 0, 0, 0);
    const end = new Date(d); end.setHours(23, 59, 59, 999);
    const { data, error } = await supabase
      .from("sales")
      .select(`id,public_code,created_at,status,payment_method,total_amount,source,
        staff:profiles(full_name,username),
        sale_items(qty,unit_price_at_time,line_total,product:products(name))`)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString())
      .order("created_at", { ascending: false });
    setLoading(false);
    if (error) return setErr(error.message);
    setRows((data as any) || []);
  }

  async function loadDates() {
    const { data } = await supabase.from("sales").select("created_at").order("created_at", { ascending: false });
    if (data) {
      const seen = new Set<string>();
      for (const r of data as any[]) seen.add(toDate(new Date(r.created_at)));
      setSavedDates(Array.from(seen).sort((a, b) => b.localeCompare(a)));
    }
  }

  useEffect(() => { load(date); loadDates(); }, []);

  function changeDate(d: string) {
    setDate(d); setStatusF("ALL"); setPayF("ALL"); setQ(""); load(d);
  }

  const filtered = useMemo(() => {
    let out = rows;
    if (statusF !== "ALL") out = out.filter((r) => r.status === statusF);
    if (payF !== "ALL") out = out.filter((r) => r.payment_method === payF);
    if (q.trim()) {
      const n = q.toLowerCase();
      out = out.filter((r) =>
        r.public_code?.toLowerCase().includes(n) ||
        (r.staff as any)?.username?.toLowerCase().includes(n) ||
        (r.staff as any)?.full_name?.toLowerCase().includes(n)
      );
    }
    return out;
  }, [rows, statusF, payF, q]);

  const stats = useMemo(() => {
    const paid = rows.filter((r) => r.status === "PAID");
    return {
      total: paid.reduce((s, r) => s + Number(r.total_amount || 0), 0),
      count: paid.length,
      cash: paid.filter((r) => r.payment_method === "CASH").reduce((s, r) => s + Number(r.total_amount || 0), 0),
      momo: paid.filter((r) => r.payment_method === "MOMO").reduce((s, r) => s + Number(r.total_amount || 0), 0),
    };
  }, [rows]);

  const isToday = date === todayStr;

  function displayDate(d: string) {
    if (d === todayStr) return "Today";
    const diff = Math.floor((new Date(todayStr).getTime() - new Date(d).getTime()) / 86400000);
    if (diff === 1) return "Yesterday";
    return fmtDate(d + "T00:00:00");
  }

  const yestStr = toDate(new Date(Date.now() - 86400000));

  return (
    <div className="max-w-5xl mx-auto px-5 py-8 space-y-7" style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-5">
        <div>
          <p className="text-[11px] text-[#ABABAB] uppercase tracking-widest mb-2">Transactions</p>
          <h1 className="text-[28px] text-[#1A1A1A] font-[300] leading-tight">Sales</h1>
          <p className="text-[12px] text-[#ABABAB] mt-1">
            {isToday ? "Live view — today" : `Archived · ${displayDate(date)}`}
          </p>
        </div>

        {/* Date controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {[todayStr, yestStr].map((d) => (
            <button
              key={d}
              onClick={() => changeDate(d)}
              className={[
                "rounded-full px-4 py-2 text-[12px] border transition-all",
                date === d ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#FAFAFA]",
              ].join(" ")}
            >
              {d === todayStr ? "Today" : "Yesterday"}
            </button>
          ))}
          <div className="relative">
            <select
              value={date}
              onChange={(e) => changeDate(e.target.value)}
              className="rounded-full border border-[#E8E8E8] bg-white pl-4 pr-8 py-2 text-[12px] text-[#6B6B6B] outline-none appearance-none cursor-pointer hover:bg-[#FAFAFA] transition-all"
            >
              {savedDates.length === 0 && <option value={date}>{displayDate(date)}</option>}
              {savedDates.map((d) => <option key={d} value={d}>{displayDate(d)}</option>)}
            </select>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="absolute right-3 top-1/2 -translate-y-1/2 text-[#ABABAB] pointer-events-none">
              <path d="M2 3.5L5 6.5L8 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <button
            onClick={() => load(date)}
            disabled={loading}
            className="flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-4 py-2 text-[12px] text-[#6B6B6B] hover:bg-[#FAFAFA] transition-all disabled:opacity-40"
          >
            <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ animation: loading ? "spin 0.9s linear infinite" : "none" }}>
              <path d="M10 5.5C10 7.985 7.985 10 5.5 10S1 7.985 1 5.5 3.015 1 5.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M7.5 1L10 3L7.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Refresh
          </button>
        </div>
      </div>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {!isToday && (
        <div className="rounded-2xl bg-amber-50 border border-amber-100 px-5 py-3.5 flex items-center gap-3">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-amber-500 flex-shrink-0"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4V6.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <p className="text-[12px] text-amber-700">Viewing archived data — {fmtDate(date + "T00:00:00")}</p>
          <button onClick={() => changeDate(todayStr)} className="ml-auto text-[11px] text-amber-600 hover:text-amber-800 transition-colors">Back to today</button>
        </div>
      )}

      {err && <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-[13px] text-red-500">{err}</div>}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Revenue", value: loading ? "—" : `GHS ${fmt(stats.total)}`, accent: true },
          { label: "Transactions", value: loading ? "—" : String(stats.count) },
          { label: "Cash", value: loading ? "—" : `GHS ${fmt(stats.cash)}` },
          { label: "Mobile Money", value: loading ? "—" : `GHS ${fmt(stats.momo)}` },
        ].map((k, i) => (
          <motion.div
            key={k.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.25 }}
            className={["rounded-2xl p-5 border", k.accent ? "bg-[#c0392b] border-transparent" : "bg-white border-[#F0F0F0]"].join(" ")}
          >
            <p className={["text-[10px] uppercase tracking-widest mb-3", k.accent ? "text-red-200" : "text-[#ABABAB]"].join(" ")}>{k.label}</p>
            <p className={["text-[20px] font-[300] leading-none", k.accent ? "text-white" : "text-[#1A1A1A]"].join(" ")}>{k.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ABABAB] pointer-events-none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          <input className="w-full rounded-xl border border-[#E8E8E8] bg-white pl-10 pr-4 py-2.5 text-[13px] text-[#1A1A1A] placeholder-[#ABABAB] outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 transition-all" placeholder="Search code or staff…" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          {(["ALL", "PAID", "PENDING", "CANCELLED"] as StatusF[]).map((s) => (
            <button key={s} onClick={() => setStatusF(s)} className={["rounded-full px-3.5 py-2 text-[11px] border transition-all", statusF === s ? "bg-[#1A1A1A] text-white border-[#1A1A1A]" : "bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#FAFAFA]"].join(" ")}>
              {s === "ALL" ? "All" : s.charAt(0) + s.slice(1).toLowerCase()}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {(["ALL", "CASH", "MOMO"] as PayF[]).map((p) => (
            <button key={p} onClick={() => setPayF(p)} className={["rounded-full px-3.5 py-2 text-[11px] border transition-all", payF === p ? "bg-[#c0392b] text-white border-[#c0392b]" : "bg-white text-[#6B6B6B] border-[#E8E8E8] hover:bg-[#FAFAFA]"].join(" ")}>
              {p === "ALL" ? "All pay" : p}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#F8F8F8]">
          {["Code", "Time", "Staff", "Source", "Pay", "Amount", "Status", ""].map((h, i) => (
            <div key={i} className={["text-[10px] text-[#ABABAB] uppercase tracking-widest", i === 0 ? "col-span-2" : i === 1 ? "col-span-1" : i === 2 ? "col-span-2" : i === 3 ? "col-span-1" : i === 4 ? "col-span-1" : i === 5 ? "col-span-2" : i === 6 ? "col-span-2" : "col-span-1"].join(" ")}>{h}</div>
          ))}
        </div>

        {loading ? (
          <div className="p-5 space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 rounded-xl bg-[#FAFAFA] animate-pulse" style={{ animationDelay: `${i * 0.05}s` }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-[15px] text-[#CACACA] font-[300]">{q || statusF !== "ALL" || payF !== "ALL" ? "No matching records" : `No sales ${isToday ? "yet today" : displayDate(date).toLowerCase()}`}</p>
            <p className="text-[11px] text-[#D8D8D8] mt-1">{!q && statusF === "ALL" && payF === "ALL" && isToday ? "Completed transactions appear here" : "Try adjusting filters"}</p>
          </div>
        ) : (
          filtered.map((s, i) => {
            const staff = s.staff as any;
            const expanded = expandedId === s.id;
            const items = (s.sale_items || []) as any[];
            const isLast = i === filtered.length - 1;

            return (
              <motion.div
                key={s.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: Math.min(i * 0.02, 0.3), duration: 0.2 }}
              >
                {/* Desktop row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  className={["hidden sm:grid grid-cols-12 gap-4 items-center px-5 py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors select-none", !isLast || expanded ? "border-b border-[#F8F8F8]" : ""].join(" ")}
                >
                  <div className="col-span-2">
                    <span className="text-[11px] text-[#6B6B6B] font-mono bg-[#F5F5F5] rounded-md px-2 py-0.5">{s.public_code || s.id.slice(0, 8)}</span>
                  </div>
                  <div className="col-span-1 text-[12px] text-[#ABABAB]">{fmtTime(s.created_at)}</div>
                  <div className="col-span-2 text-[12px] text-[#1A1A1A] truncate">{staff?.full_name || staff?.username || "—"}</div>
                  <div className="col-span-1">
                    <span className={["text-[10px] rounded-md px-2 py-0.5", s.source === "STAFF_MANUAL" ? "bg-blue-50 border border-blue-100 text-blue-600" : "bg-violet-50 border border-violet-100 text-violet-600"].join(" ")}>
                      {s.source === "STAFF_MANUAL" ? "POS" : "Scan"}
                    </span>
                  </div>
                  <div className="col-span-1 text-[12px] text-[#ABABAB]">{s.payment_method}</div>
                  <div className="col-span-2 text-[13px] text-[#1A1A1A]">GHS {fmt(s.total_amount)}</div>
                  <div className="col-span-2">
                    <span className={["text-[10px] rounded-md px-2 py-0.5", STATUS_STYLE[s.status]].join(" ")}>
                      {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <svg width="11" height="11" viewBox="0 0 11 11" fill="none" className="text-[#CACACA]" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                      <path d="M1.5 3.5L5.5 7.5L9.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Mobile row */}
                <div
                  onClick={() => setExpandedId(expanded ? null : s.id)}
                  className={["sm:hidden flex items-center gap-3 px-4 py-4 cursor-pointer hover:bg-[#FAFAFA] transition-colors", !isLast || expanded ? "border-b border-[#F8F8F8]" : ""].join(" ")}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-[11px] text-[#6B6B6B] font-mono bg-[#F5F5F5] rounded px-1.5 py-0.5">{s.public_code || s.id.slice(0, 6)}</span>
                      <span className={["text-[10px] rounded px-1.5 py-0.5", STATUS_STYLE[s.status]].join(" ")}>{s.status.charAt(0) + s.status.slice(1).toLowerCase()}</span>
                    </div>
                    <p className="text-[11px] text-[#ABABAB]">{fmtTime(s.created_at)} · {staff?.full_name || staff?.username || "—"} · {s.payment_method}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-[13px] text-[#1A1A1A]">GHS {fmt(s.total_amount)}</p>
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="ml-auto mt-1 text-[#CACACA]" style={{ transform: expanded ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.2s" }}>
                      <path d="M1.5 3.5L5 6.5L8.5 3.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                </div>

                {/* Expanded */}
                <AnimatePresence>
                  {expanded && (
                    <motion.div
                      key={`exp-${s.id}`}
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden border-b border-[#F8F8F8]"
                    >
                      <div className="px-5 py-4 bg-[#FAFAFA]">
                        <p className="text-[10px] text-[#ABABAB] uppercase tracking-widest mb-3">Line items</p>
                        <div className="space-y-2">
                          {items.map((it: any, idx: number) => (
                            <motion.div
                              key={idx}
                              initial={{ opacity: 0, x: -4 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.04, duration: 0.18 }}
                              className="flex items-center justify-between bg-white rounded-xl border border-[#F0F0F0] px-4 py-3"
                            >
                              <div className="flex items-center gap-3">
                                <span className="h-6 w-6 rounded-full bg-[#FFF5F5] text-[#c0392b] text-[10px] flex items-center justify-center">{it.qty}</span>
                                <span className="text-[12px] text-[#1A1A1A]">{it.product?.name || "Unknown"}</span>
                              </div>
                              <div className="text-right">
                                <p className="text-[12px] text-[#1A1A1A]">GHS {fmt(it.line_total)}</p>
                                <p className="text-[10px] text-[#ABABAB]">GHS {fmt(it.unit_price_at_time)} ea.</p>
                              </div>
                            </motion.div>
                          ))}
                          <div className="flex items-center justify-between px-4 pt-1">
                            <span className="text-[11px] text-[#ABABAB]">Total</span>
                            <span className="text-[13px] text-[#1A1A1A]">GHS {fmt(s.total_amount)}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
        {!loading && filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-[#F8F8F8]">
            <p className="text-[10px] text-[#CACACA]">{filtered.length} record{filtered.length !== 1 ? "s" : ""} · click any row to expand</p>
          </div>
        )}
      </div>
    </div>
  );
}