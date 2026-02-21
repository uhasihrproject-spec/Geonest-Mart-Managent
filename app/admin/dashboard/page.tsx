"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";

function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 17) return "Good afternoon";
  if (h >= 17 && h < 21) return "Good evening";
  return "Good night";
}

type Summary = {
  total: number;
  count: number;
  cash: number;
  momo: number;
  manual: number;
  scan: number;
  enable_customer_scan: boolean;
};

export default function Dashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Summary | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState(false);
  const [greeting] = useState(getGreeting);
  const [now] = useState(() =>
    new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })
  );

  async function load() {
    setErr(null);
    setLoading(true);
    const res = await fetch("/api/admin/dashboard/summary");
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) return setErr(json.error || "Failed to load.");
    setData(json);
  }

  useEffect(() => { load(); }, []);

  async function toggleScan(next: boolean) {
    if (!data) return;
    setToggling(true);
    const res = await fetch("/api/admin/settings/scan", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enable: next }),
    });
    const json = await res.json().catch(() => ({}));
    setToggling(false);
    if (!res.ok) return setErr(json.error || "Failed.");
    setData({ ...data, enable_customer_scan: next });
  }

  const manualPct = useMemo(() => {
    if (!data || (data.manual + data.scan) === 0) return 0;
    return Math.round((data.manual / (data.manual + data.scan)) * 100);
  }, [data]);

  const scanPct = 100 - manualPct;

  const kpis = data
    ? [
        { label: "Revenue", value: `GHS ${fmt(data.total)}`, sub: "Paid today", accent: true },
        { label: "Transactions", value: String(data.count), sub: "Completed" },
        { label: "Cash", value: `GHS ${fmt(data.cash)}`, sub: "In person" },
        { label: "Mobile Money", value: `GHS ${fmt(data.momo)}`, sub: "MoMo" },
      ]
    : [];

  return (
    <div
      className="max-w-5xl mx-auto px-5 py-8 space-y-8"
      style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-6">
        <div>
          <p className="text-[11px] text-[#ABABAB] uppercase tracking-widest mb-2">{now}</p>
          <h1 className="text-[28px] text-[#1A1A1A] font-[300] leading-tight">{greeting}</h1>
          <p className="text-[13px] text-[#ABABAB] mt-1">Here's what's happening today.</p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-4 py-2 text-[12px] text-[#6B6B6B] hover:bg-[#FAFAFA] transition-all disabled:opacity-40 flex-shrink-0"
        >
          <svg
            width="11" height="11" viewBox="0 0 11 11" fill="none"
            style={{ animation: loading ? "spin 0.9s linear infinite" : "none" }}
          >
            <path d="M10 5.5C10 7.985 7.985 10 5.5 10S1 7.985 1 5.5 3.015 1 5.5 1" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M7.5 1L10 3L7.5 5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Refresh
        </button>
      </div>

      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {err && (
        <div className="rounded-2xl bg-red-50 border border-red-100 px-5 py-4 text-[13px] text-red-500">
          {err}
        </div>
      )}

      {/* KPI cards */}
      {loading && !data ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white border border-[#F0F0F0] animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {kpis.map((k, i) => (
            <motion.div
              key={k.label}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
              className={[
                "rounded-2xl p-5 border",
                k.accent
                  ? "bg-[#c0392b] border-transparent"
                  : "bg-white border-[#F0F0F0] hover:border-[#E0E0E0] transition-colors",
              ].join(" ")}
            >
              <p className={["text-[10px] uppercase tracking-widest mb-3", k.accent ? "text-red-200" : "text-[#ABABAB]"].join(" ")}>{k.label}</p>
              <p className={["text-[20px] font-[300] leading-none", k.accent ? "text-white" : "text-[#1A1A1A]"].join(" ")}>{k.value}</p>
              <p className={["text-[11px] mt-2", k.accent ? "text-red-200" : "text-[#CACACA]"].join(" ")}>{k.sub}</p>
            </motion.div>
          ))}
        </div>
      )}

      {/* Lower section */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Source breakdown */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="lg:col-span-2 bg-white rounded-2xl border border-[#F0F0F0] p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <p className="text-[15px] text-[#1A1A1A] font-[400]">Source breakdown</p>
                <p className="text-[11px] text-[#ABABAB] mt-0.5">Where paid transactions originate</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2">Staff Manual</p>
                <p className="text-[22px] text-[#1A1A1A] font-[300]">GHS {fmt(data.manual)}</p>
                <p className="text-[11px] text-[#ABABAB] mt-1">{manualPct}%</p>
              </div>
              <div>
                <p className="text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2">Customer Scan</p>
                <p className="text-[22px] text-[#1A1A1A] font-[300]">GHS {fmt(data.scan)}</p>
                <p className="text-[11px] text-[#ABABAB] mt-1">{scanPct}%</p>
              </div>
            </div>
            <div className="h-px bg-[#F5F5F5] rounded-full overflow-hidden relative">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${manualPct}%` }}
                transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
                className="absolute top-0 left-0 h-full bg-[#c0392b]"
              />
              {/* Make the bar visible */}
              <div className="h-1.5 opacity-0" />
            </div>
            <div className="h-1.5 rounded-full bg-[#F5F5F5] overflow-hidden mt-0 -mt-1.5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${manualPct}%` }}
                transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.4 }}
                className="h-full bg-[#c0392b] rounded-full"
              />
            </div>
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10px] text-[#ABABAB]">Staff — {manualPct}%</span>
              <span className="text-[10px] text-[#ABABAB]">Scan — {scanPct}%</span>
            </div>
          </motion.div>

          {/* Scan toggle */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.34, duration: 0.3, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="bg-white rounded-2xl border border-[#F0F0F0] p-6"
          >
            <p className="text-[15px] text-[#1A1A1A] font-[400] mb-1">Customer scan</p>
            <p className="text-[11px] text-[#ABABAB] mb-6">Allow customers to self-checkout by scanning</p>
            <div
              className={[
                "rounded-xl border p-4 mb-4 transition-all duration-300",
                data.enable_customer_scan ? "border-[#c0392b]/20 bg-red-50/30" : "border-[#F0F0F0] bg-[#FAFAFA]",
              ].join(" ")}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[12px] text-[#1A1A1A]">Scan checkout</p>
                  <p className={["text-[10px] mt-0.5", data.enable_customer_scan ? "text-[#c0392b]" : "text-[#ABABAB]"].join(" ")}>
                    {data.enable_customer_scan ? "Active" : "Off"}
                  </p>
                </div>
                <button
                  disabled={toggling}
                  onClick={() => toggleScan(!data.enable_customer_scan)}
                  className={[
                    "relative h-6 w-11 rounded-full transition-colors duration-300",
                    data.enable_customer_scan ? "bg-[#c0392b]" : "bg-[#E0E0E0]",
                  ].join(" ")}
                >
                  <span
                    className="absolute top-1 h-4 w-4 rounded-full bg-white shadow-sm transition-all duration-300"
                    style={{ left: data.enable_customer_scan ? 26 : 2 }}
                  />
                </button>
              </div>
            </div>
            <p className="text-[10px] text-[#CACACA] leading-relaxed">
              Disable during busy periods so staff manages all entries manually.
            </p>
          </motion.div>
        </div>
      )}
    </div>
  );
}