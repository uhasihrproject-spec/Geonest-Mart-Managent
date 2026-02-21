"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

type Profile = { id: string; username: string; full_name: string | null; role: "ADMIN" | "STAFF"; active: boolean; force_password_change: boolean };

const INP = "w-full rounded-xl border border-[#E8E8E8] bg-white px-4 py-3 text-[13px] text-[#1A1A1A] placeholder-[#ABABAB] outline-none focus:ring-2 focus:ring-[#c0392b]/15 focus:border-[#c0392b]/40 transition-all";
const LABEL = "block text-[10px] text-[#ABABAB] uppercase tracking-widest mb-2";

const AVATAR_COLORS = [
  { from: "#FCA5A5", to: "#c0392b" },
  { from: "#FCD34D", to: "#D97706" },
  { from: "#6EE7B7", to: "#059669" },
  { from: "#93C5FD", to: "#2563EB" },
  { from: "#C4B5FD", to: "#7C3AED" },
];

function Avatar({ name }: { name: string }) {
  const c = AVATAR_COLORS[name.charCodeAt(0) % AVATAR_COLORS.length];
  const initials = name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="h-8 w-8 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-[600]"
      style={{ background: `linear-gradient(135deg, ${c.from}, ${c.to})` }}
    >
      {initials}
    </div>
  );
}

export default function StaffPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [tempPassword, setTempPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [creating, setCreating] = useState(false);
  const [flash, setFlash] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [showAdd, setShowAdd] = useState(false);

  useEffect(() => {
    if (flash) { const t = setTimeout(() => setFlash(null), 3000); return () => clearTimeout(t); }
  }, [flash]);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.from("profiles").select("id,username,full_name,role,active,force_password_change").order("role").order("created_at");
    setLoading(false);
    if (error) return setFlash({ type: "err", text: error.message });
    setRows((data as any) || []);
  }
  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const n = q.trim().toLowerCase();
    if (!n) return rows;
    return rows.filter((r) => r.username.toLowerCase().includes(n) || (r.full_name || "").toLowerCase().includes(n));
  }, [rows, q]);

  async function createStaff() {
    if (!username.trim()) return setFlash({ type: "err", text: "Username required." });
    if (tempPassword.trim().length < 8) return setFlash({ type: "err", text: "Password must be 8+ characters." });
    setCreating(true);
    const res = await fetch("/api/admin/staff/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: username.trim(), full_name: fullName.trim() || null, temp_password: tempPassword.trim() }),
    });
    const json = await res.json().catch(() => ({}));
    setCreating(false);
    if (!res.ok) return setFlash({ type: "err", text: json.error || "Failed." });
    setUsername(""); setFullName(""); setTempPassword(""); setShowAdd(false);
    setFlash({ type: "ok", text: `Account created for @${username.trim()}` });
    load();
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch("/api/admin/staff/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, active }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setFlash({ type: "err", text: json.error || "Failed." });
    setFlash({ type: "ok", text: active ? "Account enabled." : "Account disabled." });
    load();
  }



  async function removeStaff(id: string, username: string) {
    const ok = window.confirm(`Remove @${username}? This action cannot be undone.`);
    if (!ok) return;
    const res = await fetch("/api/admin/staff/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setFlash({ type: "err", text: json.error || "Failed." });
    setFlash({ type: "ok", text: `Removed @${username}` });
    load();
  }

  async function resetPassword(id: string) {
    const pw = prompt("New temporary password (8+ characters):");
    if (!pw || pw.trim().length < 8) return setFlash({ type: "err", text: "Password must be 8+ characters." });
    const res = await fetch("/api/admin/staff/reset-password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, temp_password: pw.trim() }) });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) return setFlash({ type: "err", text: json.error || "Failed." });
    setFlash({ type: "ok", text: "Password reset." });
    load();
  }

  const activeCount = rows.filter((r) => r.role === "STAFF" && r.active).length;
  const totalStaff = rows.filter((r) => r.role === "STAFF").length;

  return (
    <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8" style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}>
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <p className="text-[11px] text-[#ABABAB] uppercase tracking-widest mb-2">Team</p>
          <h1 className="text-[28px] text-[#1A1A1A] font-[300] leading-tight">Staff</h1>
          <p className="text-[12px] text-[#ABABAB] mt-1">{activeCount} active · {totalStaff} total</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowAdd((v) => !v)}
            className="flex items-center gap-2 rounded-full border border-[#E8E8E8] bg-white px-4 py-2 text-[12px] text-[#6B6B6B] hover:bg-[#FAFAFA] transition-all"
          >
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M5 1V9M1 5H9" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/></svg>
            {showAdd ? "Cancel" : "Add staff"}
          </button>
        </div>
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
            className={["mb-5 rounded-2xl px-5 py-4 text-[13px]", flash.type === "ok" ? "bg-[#F0FDF4] text-[#16A34A] border border-green-100" : "bg-red-50 text-red-500 border border-red-100"].join(" ")}
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
              <p className="text-[15px] text-[#1A1A1A] font-[400] mb-1">New staff account</p>
              <p className="text-[11px] text-[#ABABAB] mb-5">Staff will be prompted to change their password on first login.</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
                <div>
                  <label className={LABEL}>Username</label>
                  <input className={INP} placeholder="e.g. ama_mensah" value={username} onChange={(e) => setUsername(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Full name</label>
                  <input className={INP} placeholder="Optional" value={fullName} onChange={(e) => setFullName(e.target.value)} />
                </div>
                <div>
                  <label className={LABEL}>Temp password</label>
                  <div className="relative">
                    <input className={INP + " pr-11"} placeholder="8+ characters" type={showPw ? "text" : "password"} value={tempPassword} onChange={(e) => setTempPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPw((v) => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#ABABAB] hover:text-[#6B6B6B] transition-colors">
                      {showPw
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3 3 7 3S13 7 13 7 11 11 7 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.1"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3 3 7 3S13 7 13 7 11 11 7 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.1"/><circle cx="7" cy="7" r="1.5" stroke="currentColor" strokeWidth="1.1"/></svg>
                      }
                    </button>
                  </div>
                </div>
              </div>
              <div className="flex justify-end">
                <button onClick={createStaff} disabled={creating} className="rounded-full bg-[#c0392b] px-6 py-2.5 text-[12px] text-white hover:bg-[#a93226] disabled:opacity-50 transition-colors flex items-center gap-2">
                  {creating && <span className="h-3.5 w-3.5 rounded-full border-2 border-white/30 border-t-white animate-spin" />}
                  {creating ? "Creating…" : "Create account"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative mb-5">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="absolute left-4 top-1/2 -translate-y-1/2 text-[#ABABAB] pointer-events-none"><circle cx="5.5" cy="5.5" r="4" stroke="currentColor" strokeWidth="1.2"/><path d="M9 9L11.5 11.5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
        <input className="w-full rounded-xl border border-[#E8E8E8] bg-[#FAFAFA] pl-10 pr-4 py-3 text-[13px] text-[#1A1A1A] placeholder-[#ABABAB] outline-none focus:ring-2 focus:ring-[#c0392b]/12 focus:border-[#c0392b]/30 focus:bg-white transition-all" placeholder="Search staff…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {/* List */}
      <div className="bg-white rounded-2xl border border-[#F0F0F0] overflow-hidden">
        <div className="hidden sm:grid grid-cols-12 gap-4 px-5 py-3 border-b border-[#F8F8F8]">
          <div className="col-span-4 text-[10px] text-[#ABABAB] uppercase tracking-widest">User</div>
          <div className="col-span-2 text-[10px] text-[#ABABAB] uppercase tracking-widest">Role</div>
          <div className="col-span-3 text-[10px] text-[#ABABAB] uppercase tracking-widest">Status</div>
          <div className="col-span-3 text-[10px] text-[#ABABAB] uppercase tracking-widest">Actions</div>
        </div>

        {loading ? (
          <div className="p-5 space-y-3">
            {[...Array(3)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-[#FAFAFA] animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center"><p className="text-[15px] text-[#CACACA] font-[300]">No staff found</p></div>
        ) : (
          filtered.map((u, i) => (
            <motion.div
              key={u.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.2 }}
            >
              {/* Desktop */}
              <div className={["hidden sm:grid grid-cols-12 gap-4 items-center px-5 py-4 hover:bg-[#FAFAFA] transition-colors", i < filtered.length - 1 ? "border-b border-[#F8F8F8]" : ""].join(" ")}>
                <div className="col-span-4 flex items-center gap-3 min-w-0">
                  <Avatar name={u.full_name || u.username} />
                  <div className="min-w-0">
                    <p className="text-[13px] text-[#1A1A1A] truncate">{u.full_name || u.username}</p>
                    <p className="text-[11px] text-[#ABABAB]">@{u.username}</p>
                  </div>
                </div>
                <div className="col-span-2">
                  <span className={["text-[10px] rounded-md px-2 py-0.5", u.role === "ADMIN" ? "bg-[#FFF5F5] text-[#c0392b] border border-[#c0392b]/10" : "bg-[#F5F5F5] text-[#6B6B6B]"].join(" ")}>{u.role}</span>
                </div>
                <div className="col-span-3 flex items-center gap-1.5 flex-wrap">
                  <span className={["text-[10px] rounded-md px-2 py-0.5 flex items-center gap-1", u.active ? "bg-green-50 text-green-700 border border-green-100" : "bg-[#F5F5F5] text-[#ABABAB]"].join(" ")}>
                    <span className={["h-1 w-1 rounded-full", u.active ? "bg-green-500" : "bg-[#CACACA]"].join(" ")} />
                    {u.active ? "Active" : "Disabled"}
                  </span>
                  {u.force_password_change && <span className="text-[10px] rounded-md px-2 py-0.5 bg-amber-50 text-amber-700 border border-amber-100">Must change pw</span>}
                </div>
                <div className="col-span-3 flex items-center gap-2">
                  {u.role === "STAFF" ? (
                    <>
                      <button onClick={() => toggleActive(u.id, !u.active)} className={["rounded-lg border px-3 py-1.5 text-[11px] transition-all", u.active ? "border-[#E8E8E8] text-[#6B6B6B] hover:bg-[#F5F5F5]" : "border-green-200 bg-green-50 text-green-700 hover:bg-green-100"].join(" ")}>
                        {u.active ? "Disable" : "Enable"}
                      </button>
                      <button onClick={() => resetPassword(u.id)} className="rounded-lg border border-[#E8E8E8] px-3 py-1.5 text-[11px] text-[#6B6B6B] hover:bg-[#F5F5F5] transition-all">
                        Reset pw
                      </button>
                      <button onClick={() => removeStaff(u.id, u.username)} className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-[11px] text-red-600 hover:bg-red-100 transition-all">
                        Remove
                      </button>
                    </>
                  ) : (
                    <span className="text-[11px] text-[#CACACA]">Protected</span>
                  )}
                </div>
              </div>

              {/* Mobile */}
              <div className={["sm:hidden px-4 py-4", i < filtered.length - 1 ? "border-b border-[#F8F8F8]" : ""].join(" ")}>
                <div className="flex items-center gap-3 mb-3">
                  <Avatar name={u.full_name || u.username} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-[13px] text-[#1A1A1A] truncate">{u.full_name || u.username}</p>
                      <span className={["text-[10px] rounded px-1.5 py-0.5", u.role === "ADMIN" ? "bg-[#FFF5F5] text-[#c0392b]" : "bg-[#F5F5F5] text-[#6B6B6B]"].join(" ")}>{u.role}</span>
                    </div>
                    <p className="text-[11px] text-[#ABABAB]">@{u.username} · {u.active ? "Active" : "Disabled"}</p>
                  </div>
                </div>
                {u.role === "STAFF" && (
                  <div className="flex gap-2">
                    <button onClick={() => toggleActive(u.id, !u.active)} className={["flex-1 rounded-xl py-2.5 text-[12px] border text-center transition-all", u.active ? "border-[#E8E8E8] text-[#6B6B6B]" : "border-green-200 bg-green-50 text-green-700"].join(" ")}>
                      {u.active ? "Disable" : "Enable"}
                    </button>
                    <button onClick={() => resetPassword(u.id)} className="flex-1 rounded-xl py-2.5 text-[12px] border border-[#E8E8E8] text-[#6B6B6B] text-center">
                      Reset password
                    </button>
                    <button onClick={() => removeStaff(u.id, u.username)} className="flex-1 rounded-xl py-2.5 text-[12px] border border-red-200 bg-red-50 text-red-600 text-center">
                      Remove
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          ))
        )}
        <div className="px-5 py-3 border-t border-[#F8F8F8]">
          <p className="text-[10px] text-[#CACACA]">Admin accounts are protected and cannot be modified here.</p>
        </div>
      </div>
    </div>
  );
}