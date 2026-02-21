"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

const SIDEBAR_KEY = "fw_sb_v5";

type Me = { username: string; full_name: string | null };

/* ── Helpers ──────────────────────────────────────────────── */
function cls(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}
function fmt(n: number) {
  return new Intl.NumberFormat("en-GH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

/* ── Nav definition ───────────────────────────────────────── */
const NAV = [
  {
    href: "/admin/dashboard",
    label: "Overview",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <rect x="1" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.15"/>
        <rect x="8.5" y="1" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.15"/>
        <rect x="1" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.15"/>
        <rect x="8.5" y="8.5" width="5.5" height="5.5" rx="1.5" stroke="currentColor" strokeWidth="1.15"/>
      </svg>
    ),
  },
  {
    href: "/admin/products",
    label: "Products",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M7.5 1.5L13.5 4.5V10.5L7.5 13.5L1.5 10.5V4.5L7.5 1.5Z" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round"/>
        <path d="M7.5 1.5V13.5M1.5 4.5L7.5 7.5L13.5 4.5" stroke="currentColor" strokeWidth="1.15" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/sales",
    label: "Sales",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M1 11L4.5 7.5L7.5 10.5L11 5L14 8" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
        <path d="M11 3H14V6" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/inventory",
    label: "Inventory",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <path d="M2 3.5H13M2 7.5H13M2 11.5H8.5" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/>
        <circle cx="12" cy="11.5" r="2.5" stroke="currentColor" strokeWidth="1.15"/>
        <path d="M12 10.5V11.5L12.7 12.2" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    href: "/admin/staff",
    label: "Staff",
    icon: (
      <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
        <circle cx="7.5" cy="5" r="2.5" stroke="currentColor" strokeWidth="1.15"/>
        <path d="M2 14C2 11.239 4.462 9 7.5 9C10.538 9 13 11.239 13 14" stroke="currentColor" strokeWidth="1.15" strokeLinecap="round"/>
      </svg>
    ),
  },
];

/* ── NavItem ──────────────────────────────────────────────── */
function NavItem({
  item,
  collapsed,
  onNavigate,
}: {
  item: (typeof NAV)[number];
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      title={collapsed ? item.label : undefined}
      className={cls(
        "group flex items-center gap-3 rounded-[10px] px-2.5 py-2 text-[13px] transition-all duration-150 select-none",
        active
          ? "bg-[#c0392b] text-white"
          : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-[#F5F5F5]"
      )}
    >
      <span className="flex-shrink-0">{item.icon}</span>
      {!collapsed && <span className="truncate font-[380]">{item.label}</span>}
    </Link>
  );
}

/* ── Layout ───────────────────────────────────────────────── */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = supabaseBrowser();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [todayRev, setTodayRev] = useState<number | null>(null);
  const [ready, setReady] = useState(false);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try { setCollapsed(localStorage.getItem(SIDEBAR_KEY) !== "0"); } catch { }
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0"); } catch { }
  }, [collapsed, ready]);

  /* close mobile sidebar when tapping outside */
  function handleBackdropClick(e: React.MouseEvent) {
    if (e.target === backdropRef.current) setMobileOpen(false);
  }

  /* keyboard ESC to close */
  useEffect(() => {
    const fn = (e: KeyboardEvent) => { if (e.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return;
      const [{ data: p }, { data: s }] = await Promise.all([
        supabase.from("profiles").select("username,full_name").eq("id", uid).maybeSingle(),
        supabase
          .from("sales")
          .select("total_amount")
          .eq("status", "PAID")
          .gte("created_at", (() => { const d = new Date(); d.setHours(0,0,0,0); return d.toISOString(); })()),
      ]);
      if (p) setMe(p as Me);
      setTodayRev((s || []).reduce((a: number, r: any) => a + Number(r.total_amount || 0), 0));
    })();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
  }

  const initials = me?.full_name
    ? me.full_name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()
    : "FW";

  /* ── Sidebar inner ────────────────────────────────────────── */
  function SidebarInner({ mobile = false }: { mobile?: boolean }) {
    const exp = mobile || !collapsed;
    return (
      <div className="flex flex-col h-full" style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}>

        {/* Brand row */}
        <div className={cls("flex items-center h-14 px-4 border-b border-[#F0F0F0] flex-shrink-0", exp ? "gap-3" : "justify-center")}>
          <img src="/logo/logo.svg" alt="Geonest Mart" className="h-6 w-6 object-contain flex-shrink-0" />
          {exp && (
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[#1A1A1A] font-[450] leading-none truncate">Geonest Mart</p>
              <p className="text-[10px] text-[#ABABAB] mt-0.5 leading-none">Admin</p>
            </div>
          )}
          {!mobile && exp && (
            <button
              onClick={() => setCollapsed(true)}
              className="ml-auto flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[#CACACA] hover:text-[#6B6B6B] hover:bg-[#F5F5F5] transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M8 2L4 6L8 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {!mobile && !exp && (
            <button
              onClick={() => setCollapsed(false)}
              className="flex-shrink-0 h-7 w-7 rounded-lg flex items-center justify-center text-[#CACACA] hover:text-[#6B6B6B] hover:bg-[#F5F5F5] transition-all"
            >
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M4 2L8 6L4 10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          )}
          {mobile && (
            <button onClick={() => setMobileOpen(false)} className="ml-auto text-[#CACACA] hover:text-[#6B6B6B] p-1.5 rounded-lg hover:bg-[#F5F5F5] transition-all flex-shrink-0">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M1.5 1.5L10.5 10.5M10.5 1.5L1.5 10.5" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/></svg>
            </button>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-px">
          {NAV.map((item) => (
            <NavItem key={item.href} item={item} collapsed={!exp} onNavigate={mobile ? () => setMobileOpen(false) : undefined} />
          ))}
        </nav>

        {/* Revenue — only when expanded */}
        {exp && (
          <div className="mx-3 mb-3">
            <div className="rounded-xl bg-[#FAFAFA] border border-[#F0F0F0] px-3.5 py-3">
              <p className="text-[10px] text-[#ABABAB] tracking-wide uppercase mb-1">Today</p>
              <p className="text-[15px] text-[#1A1A1A] font-[400]">
                GHS {todayRev === null ? "—" : fmt(todayRev)}
              </p>
            </div>
          </div>
        )}

        {/* User + actions */}
        <div className={cls("border-t border-[#F0F0F0] p-3 flex-shrink-0 space-y-2", !exp ? "flex flex-col items-center gap-2" : "")}>
          <div className={cls("flex items-center gap-2.5", !exp ? "justify-center" : "")}>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-300 to-[#c0392b] flex items-center justify-center flex-shrink-0 text-white text-[10px] font-[600]">
              {initials}
            </div>
            {exp && (
              <div className="min-w-0 flex-1">
                <p className="text-[12px] text-[#1A1A1A] font-[400] truncate">{me?.full_name || "Admin"}</p>
                <p className="text-[10px] text-[#ABABAB] truncate">@{me?.username}</p>
              </div>
            )}
          </div>
          {exp && (
            <>
              <Link
                href="/pos"
                onClick={mobile ? () => setMobileOpen(false) : undefined}
                className="flex items-center justify-center gap-1.5 w-full rounded-[10px] bg-[#c0392b] py-2.5 text-[12px] text-white hover:bg-[#a93226] transition-colors"
              >
                <svg width="11" height="11" viewBox="0 0 11 11" fill="none"><rect x="0.5" y="0.5" width="10" height="10" rx="1.5" stroke="currentColor" strokeWidth="1.1"/><path d="M2.5 5H8.5M2.5 3.5H5.5M2.5 6.5H7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
                Point of Sale
              </Link>
              <button
                onClick={signOut}
                className="w-full text-center py-1.5 text-[11px] text-[#ABABAB] hover:text-[#6B6B6B] transition-colors"
              >
                Sign out
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-screen bg-[#FAFAFA] overflow-hidden"
      style={{ fontFamily: "'Geist','DM Sans','Helvetica Neue',sans-serif" }}
    >
      {/* Desktop sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 56 : 210 }}
        transition={{ type: "spring", stiffness: 300, damping: 35 }}
        className="hidden md:flex flex-col bg-white border-r border-[#F0F0F0] flex-shrink-0 overflow-hidden"
      >
        {ready && <SidebarInner />}
      </motion.aside>

      {/* Content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <header className="h-14 flex-shrink-0 bg-white border-b border-[#F0F0F0] flex items-center px-5 gap-4">
          {/* Mobile burger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden h-9 w-9 rounded-lg flex items-center justify-center text-[#6B6B6B] hover:bg-[#F5F5F5] transition-all -ml-1"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M2 4H13M2 7.5H13M2 11H8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
          </button>

          <div className="flex-1 min-w-0">
            <p className="text-[12px] text-[#ABABAB] hidden sm:block">Ministry of Finance, Budget and National Planning</p>
            <p className="text-[13px] text-[#1A1A1A] font-[450] sm:hidden">Geonest Mart</p>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            {todayRev !== null && (
              <div className="hidden sm:flex items-center gap-2 rounded-full border border-[#F0F0F0] bg-[#FAFAFA] px-3.5 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#c0392b]" />
                <span className="text-[11px] text-[#6B6B6B]">GHS {fmt(todayRev)}</span>
              </div>
            )}
            <button className="relative h-9 w-9 rounded-lg flex items-center justify-center text-[#ABABAB] hover:bg-[#F5F5F5] transition-all">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M7.5 1C5.567 1 4 2.567 4 4.5V9L2.5 10.5V11.5H12.5V10.5L11 9V4.5C11 2.567 9.433 1 7.5 1Z" stroke="currentColor" strokeWidth="1.1"/><path d="M6 11.5C6 12.328 6.672 13 7.5 13C8.328 13 9 12.328 9 11.5" stroke="currentColor" strokeWidth="1.1"/></svg>
              <span className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-[#c0392b]" />
            </button>
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-rose-300 to-[#c0392b] flex items-center justify-center text-white text-[10px] font-[600] cursor-pointer">
              {initials}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {/* Mobile sidebar overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            ref={backdropRef}
            onClick={handleBackdropClick}
            className="fixed inset-0 z-50 md:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            style={{ backgroundColor: "rgba(0,0,0,0.3)", backdropFilter: "blur(4px)" }}
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", stiffness: 350, damping: 38 }}
              className="absolute left-0 top-0 h-full w-64 bg-white border-r border-[#F0F0F0]"
            >
              <SidebarInner mobile />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}