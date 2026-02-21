"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { staffEmailFromUsername } from "@/lib/auth/username";

// Floating background particles
function Particle({ delay, x, size }: { delay: number; x: number; size: number }) {
  return (
    <motion.div
      className="absolute bottom-0 rounded-full opacity-0"
      style={{ left: `${x}%`, width: size, height: size, background: `rgba(192,57,43,${0.04 + Math.random() * 0.06})` }}
      animate={{ y: [0, -(400 + Math.random() * 300)], opacity: [0, 0.6, 0] }}
      transition={{ duration: 6 + Math.random() * 4, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  delay: i * 0.4,
  x: 4 + (i * 5.5) % 94,
  size: 6 + (i * 7) % 18,
}));

function SuccessGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8.2L6.6 11.3L12.5 5.4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}


function GuideOrb({ mode }: { mode: "idle" | "loading" | "success" | "error" }) {
  const color = mode === "success" ? "#10B981" : mode === "error" ? "#c0392b" : "#334155";
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 flex items-center gap-2">
      <motion.div
        className="h-7 w-7 rounded-xl flex items-center justify-center"
        style={{ background: `${color}20`, color }}
        animate={mode === "loading" ? { rotate: [0, 8, -8, 0] } : { rotate: 0 }}
        transition={{ duration: 0.8, repeat: mode === "loading" ? Infinity : 0 }}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true"><circle cx="7" cy="7" r="5.5" stroke="currentColor" strokeWidth="1.2"/><circle cx="5.3" cy="6.3" r="0.6" fill="currentColor"/><circle cx="8.7" cy="6.3" r="0.6" fill="currentColor"/><path d="M5.2 8.7C5.8 9.3 6.4 9.6 7 9.6C7.6 9.6 8.2 9.3 8.8 8.7" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/></svg>
      </motion.div>
      <p className="text-[11px] text-slate-500">{mode === "success" ? "Level cleared" : mode === "loading" ? "Checking credentials" : mode === "error" ? "Try another attempt" : "Type your username to start"}</p>
    </div>
  );
}

function ArrowGlyph({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3.5 8H12.5M9 4.5L12.5 8L9 11.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// Password strength
function pwStrength(pw: string): { score: number; label: string; color: string } {
  if (!pw) return { score: 0, label: "", color: "" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9]/.test(pw)) score++;
  if (score <= 1) return { score, label: "Weak", color: "#EF4444" };
  if (score === 2) return { score, label: "Fair", color: "#F59E0B" };
  if (score === 3) return { score, label: "Good", color: "#10B981" };
  return { score: 4, label: "Strong", color: "#059669" };
}

type Stage = "idle" | "loading" | "success" | "error";

function LoginContent() {
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get("next") || "";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState<"username" | "password" | null>(null);
  const usernameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    usernameRef.current?.focus();
  }, []);

  const userFilled = username.trim().length > 0;
  const passFilled = password.length > 0;
  const canSubmit = userFilled && passFilled && stage !== "loading";

  async function onLogin() {
    if (!canSubmit) return;
    setErr(null);
    setStage("loading");

    await new Promise(r => setTimeout(r, 300)); // tiny dramatic pause

    const email = staffEmailFromUsername(username.trim());
    const supabase = supabaseBrowser();
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setStage("error");
      setErr(
        error.message.includes("Invalid login")
          ? "Wrong username or password. Try again."
          : error.message
      );
      setTimeout(() => setStage("idle"), 600);
      return;
    }

    const uid = data.user?.id;
    if (!uid) { setStage("error"); setErr("Login failed. Try again."); setTimeout(() => setStage("idle"), 600); return; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role, force_password_change, active")
      .eq("id", uid)
      .maybeSingle();

    if (!profile?.active) {
      setStage("error");
      setErr("Your account has been disabled. Contact your admin.");
      setTimeout(() => setStage("idle"), 600);
      return;
    }

    setStage("success");
    await new Promise(r => setTimeout(r, 700));

    if (profile?.force_password_change) return router.push("/change-password");
    if (next) return router.push(next);
    return router.push(profile?.role === "ADMIN" ? "/admin/dashboard" : "/pos");
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") onLogin();
  }

  const avatarChar = username.trim() ? username.trim()[0].toUpperCase() : "?";

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
      style={{
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(192,57,43,0.07) 0%, transparent 60%), #f8fafc",
      }}
    >
      {/* Animated background particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none" aria-hidden>
        {PARTICLES.map(p => <Particle key={p.id} {...p} />)}
      </div>

      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(#c0392b 1px, transparent 1px), linear-gradient(90deg, #c0392b 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      {/* Card */}
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className={[
          "relative w-full max-w-sm bg-white rounded-3xl border transition-all duration-300 overflow-hidden",
          stage === "error"
            ? "border-[#c0392b]/30 shadow-[0_0_0_3px_rgba(192,57,43,0.08),0_20px_60px_rgba(0,0,0,0.1)]"
            : stage === "success"
            ? "border-emerald-200 shadow-[0_0_0_3px_rgba(16,185,129,0.1),0_20px_60px_rgba(0,0,0,0.1)]"
            : "border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)]",
        ].join(" ")}
        style={{
          animation: stage === "error" ? "shake 0.4s ease" : undefined,
        }}
      >
        <style>{`
          @keyframes shake {
            0%, 100% { transform: translateX(0); }
            20% { transform: translateX(-6px); }
            40% { transform: translateX(6px); }
            60% { transform: translateX(-4px); }
            80% { transform: translateX(4px); }
          }
        `}</style>

        {/* Top accent stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-[#c0392b] via-[#e74c3c] to-[#c0392b]" />

        <div className="p-7">
          {/* Brand row */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <motion.div
                animate={stage === "success" ? { rotate: [0, -10, 10, -5, 5, 0], scale: [1, 1.15, 1] } : {}}
                transition={{ duration: 0.5 }}
                className="h-10 w-10 rounded-xl overflow-hidden border border-slate-100 shadow-sm flex-shrink-0"
              >
                <img src="/logo/logo.svg" alt="Geonest Mart" className="h-full w-full object-contain" />
              </motion.div>
              <div>
                <p className="text-sm font-bold text-slate-900">Geonest Mart</p>
                <p className="text-[10px] text-slate-400">Staff Portal</p>
              </div>
            </div>

            {/* Dynamic avatar */}
            <motion.div
              animate={{
                scale: focused === "username" ? 1.08 : 1,
                background: username.trim()
                  ? stage === "success" ? "#d1fae5" : "#FFF0EE"
                  : "#f1f5f9",
              }}
              transition={{ duration: 0.2 }}
              className="h-10 w-10 rounded-xl flex items-center justify-center text-sm font-bold border"
              style={{ borderColor: username.trim() ? "rgba(192,57,43,0.2)" : "#f1f5f9" }}
            >
              <motion.span
                key={avatarChar}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 500, damping: 25 }}
                style={{ color: username.trim() ? (stage === "success" ? "#059669" : "#c0392b") : "#94a3b8" }}
              >
                {stage === "success" ? <SuccessGlyph className="h-4 w-4 text-emerald-600" /> : avatarChar}
              </motion.span>
            </motion.div>
          </div>

          {/* Title */}
          <div className="mb-6">
            <motion.h1
              animate={{ x: stage === "error" ? [0, -3, 3, -2, 2, 0] : 0 }}
              transition={{ duration: 0.35 }}
              className="text-2xl font-black text-slate-900 tracking-tight"
            >
              {stage === "success" ? "Welcome back" : "Sign in"}
            </motion.h1>
            <p className="text-sm text-slate-400 mt-1">
              {stage === "success" ? "Redirecting you now…" : "Enter your credentials to continue"}
            </p>
            <div className="mt-3">
              <GuideOrb mode={stage} />
            </div>
          </div>

          {/* Form */}
          <div className="space-y-3">
            {/* Username */}
            <div className="relative">
              <motion.div
                animate={{ scale: focused === "username" ? 1.01 : 1 }}
                transition={{ duration: 0.15 }}
              >
                <div className={[
                  "flex items-center gap-3 rounded-2xl border bg-slate-50 focus-within:bg-white px-4 py-3.5 transition-all duration-200",
                  focused === "username"
                    ? "border-[#c0392b]/40 ring-2 ring-[#c0392b]/10 shadow-sm"
                    : stage === "error"
                    ? "border-[#c0392b]/30"
                    : "border-slate-200",
                ].join(" ")}>
                  <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={focused === "username" ? "text-[#c0392b]" : "text-slate-300"} style={{ transition: "color 0.2s" }}>
                    <circle cx="7.5" cy="5.5" r="2.75" stroke="currentColor" strokeWidth="1.3"/>
                    <path d="M1.5 14C1.5 11.239 4.186 9 7.5 9C10.814 9 13.5 11.239 13.5 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  </svg>
                  <input
                    ref={usernameRef}
                    className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                    placeholder="Username"
                    value={username}
                    onChange={e => { setUsername(e.target.value); setErr(null); if (stage === "error") setStage("idle"); }}
                    onFocus={() => setFocused("username")}
                    onBlur={() => setFocused(null)}
                    onKeyDown={handleKey}
                    autoComplete="username"
                    spellCheck={false}
                    disabled={stage === "loading" || stage === "success"}
                  />
                  {userFilled && (
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                      <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </motion.span>
                  )}
                </div>
              </motion.div>
            </div>

            {/* Password */}
            <motion.div
              animate={{ scale: focused === "password" ? 1.01 : 1 }}
              transition={{ duration: 0.15 }}
            >
              <div className={[
                "flex items-center gap-3 rounded-2xl border bg-slate-50 focus-within:bg-white px-4 py-3.5 transition-all duration-200",
                focused === "password"
                  ? "border-[#c0392b]/40 ring-2 ring-[#c0392b]/10 shadow-sm"
                  : stage === "error"
                  ? "border-[#c0392b]/30"
                  : "border-slate-200",
              ].join(" ")}>
                <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={focused === "password" ? "text-[#c0392b]" : "text-slate-300"} style={{ transition: "color 0.2s" }}>
                  <rect x="2" y="6" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                  <path d="M4.5 6V4.5C4.5 3.119 5.619 2 7 2H8C9.381 2 10.5 3.119 10.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                  <circle cx="7.5" cy="10" r="1.25" fill="currentColor"/>
                </svg>
                <input
                  className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                  placeholder="Password"
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setErr(null); if (stage === "error") setStage("idle"); }}
                  onFocus={() => setFocused("password")}
                  onBlur={() => setFocused(null)}
                  onKeyDown={handleKey}
                  autoComplete="current-password"
                  disabled={stage === "loading" || stage === "success"}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(v => !v)}
                  className="flex-shrink-0 text-slate-300 hover:text-slate-500 transition-colors"
                  tabIndex={-1}
                >
                  {showPw
                    ? <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5C1 7.5 3.5 3 7.5 3C11.5 3 14 7.5 14 7.5C14 7.5 11.5 12 7.5 12C3.5 12 1 7.5 1 7.5Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/><path d="M2 2L13 13" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                    : <svg width="15" height="15" viewBox="0 0 15 15" fill="none"><path d="M1 7.5C1 7.5 3.5 3 7.5 3C11.5 3 14 7.5 14 7.5C14 7.5 11.5 12 7.5 12C3.5 12 1 7.5 1 7.5Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7.5" cy="7.5" r="2" stroke="currentColor" strokeWidth="1.2"/></svg>
                  }
                </button>
              </div>
            </motion.div>

            {/* Error */}
            <AnimatePresence>
              {err && (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, y: -6, height: 0 }}
                  animate={{ opacity: 1, y: 0, height: "auto" }}
                  exit={{ opacity: 0, y: -4, height: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="flex items-start gap-2.5 rounded-xl bg-[#FFF0EE] border border-[#c0392b]/20 px-3.5 py-3">
                    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-[#c0392b] flex-shrink-0 mt-px">
                      <circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/>
                      <path d="M6.5 4V6.5M6.5 9H6.51" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                    </svg>
                    <p className="text-xs text-[#c0392b] leading-relaxed">{err}</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              whileTap={canSubmit ? { scale: 0.98 } : {}}
              onClick={onLogin}
              disabled={!canSubmit}
              className={[
                "relative w-full rounded-2xl py-3.5 text-sm font-bold transition-all duration-300 overflow-hidden",
                stage === "success"
                  ? "bg-emerald-500 text-white shadow-[0_4px_16px_rgba(16,185,129,0.35)]"
                  : canSubmit
                  ? "bg-[#c0392b] text-white hover:bg-[#a93226] shadow-[0_4px_16px_rgba(192,57,43,0.3)] hover:shadow-[0_6px_20px_rgba(192,57,43,0.4)]"
                  : "bg-slate-100 text-slate-400 cursor-not-allowed",
              ].join(" ")}
            >
              {/* Loading shimmer */}
              {stage === "loading" && (
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                  animate={{ x: ["-100%", "100%"] }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: "easeInOut" }}
                />
              )}

              <span className="relative flex items-center justify-center gap-2">
                {stage === "loading" ? (
                  <>
                    <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                    Signing you in…
                  </>
                ) : stage === "success" ? (
                  <>
                    <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }}><SuccessGlyph className="h-4 w-4" /></motion.span>
                    Signed in!
                  </>
                ) : (
                  <>
                    Sign in
                    <motion.span
                      animate={canSubmit ? { x: [0, 3, 0] } : {}}
                      transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
                    >
                      <ArrowGlyph className="h-3.5 w-3.5" />
                    </motion.span>
                  </>
                )}
              </span>
            </motion.button>
          </div>

          {/* Footer */}
          <p className="mt-6 text-center text-[11px] text-slate-400">
            Powered by <span className="font-semibold text-slate-600">Geonest Mart</span>
          </p>
        </div>

        {/* Progress bar at bottom */}
        {stage === "loading" && (
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-[#c0392b]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.2, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginContent />
    </Suspense>
  );
}
