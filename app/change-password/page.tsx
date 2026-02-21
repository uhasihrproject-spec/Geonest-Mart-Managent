"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase/browser";

// Password strength checker
function getStrength(pw: string): { score: number; label: string; color: string; bg: string } {
  if (!pw) return { score: 0, label: "", color: "#e2e8f0", bg: "#f8fafc" };
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[0-9!@#$%^&*]/.test(pw)) score++;
  if (score === 0) return { score, label: "Too short", color: "#EF4444", bg: "#FEF2F2" };
  if (score === 1) return { score, label: "Weak", color: "#F59E0B", bg: "#FFFBEB" };
  if (score === 2) return { score, label: "Fair", color: "#F59E0B", bg: "#FFFBEB" };
  if (score === 3) return { score, label: "Good", color: "#10B981", bg: "#ECFDF5" };
  return { score: 4, label: "Strong 💪", color: "#059669", bg: "#D1FAE5" };
}

const RULES = [
  { label: "At least 8 characters", check: (pw: string) => pw.length >= 8 },
  { label: "At least one uppercase letter", check: (pw: string) => /[A-Z]/.test(pw) },
  { label: "Contains a number or symbol", check: (pw: string) => /[0-9!@#$%^&*]/.test(pw) },
];

// Confetti piece
function Confetti({ delay, x }: { delay: number; x: number }) {
  const colors = ["#c0392b", "#e74c3c", "#f39c12", "#2ecc71", "#3498db"];
  const color = colors[Math.floor(x * colors.length)];
  const size = 4 + Math.random() * 6;
  return (
    <motion.div
      className="absolute top-0 rounded-sm pointer-events-none"
      style={{ left: `${x * 100}%`, width: size, height: size, background: color, opacity: 0 }}
      animate={{
        y: [0, 300 + Math.random() * 200],
        x: [(Math.random() - 0.5) * 80],
        opacity: [0, 1, 1, 0],
        rotate: [0, Math.random() * 360],
      }}
      transition={{ duration: 1.5 + Math.random(), delay, ease: "easeOut" }}
    />
  );
}

const CONFETTI = Array.from({ length: 30 }, (_, i) => ({
  id: i,
  delay: i * 0.04,
  x: Math.random(),
}));

type Stage = "idle" | "loading" | "success";

export default function ChangePasswordPage() {
  const supabase = supabaseBrowser();
  const router = useRouter();

  const [pw1, setPw1] = useState("");
  const [pw2, setPw2] = useState("");
  const [showPw1, setShowPw1] = useState(false);
  const [showPw2, setShowPw2] = useState(false);
  const [stage, setStage] = useState<Stage>("idle");
  const [err, setErr] = useState<string | null>(null);
  const [focused, setFocused] = useState<"pw1" | "pw2" | null>(null);

  const strength = useMemo(() => getStrength(pw1), [pw1]);
  const rulesPass = RULES.map(r => r.check(pw1));
  const allRulesPass = rulesPass.every(Boolean);
  const match = pw1.length > 0 && pw2.length > 0 && pw1 === pw2;
  const canSubmit = allRulesPass && match && stage === "idle";

  async function submit() {
    if (!canSubmit) return;
    setErr(null);
    setStage("loading");

    const { data: auth } = await supabase.auth.getUser();
    const uid = auth.user?.id;
    if (!uid) {
      setStage("idle");
      setErr("Not signed in. Please go back and log in again.");
      return;
    }

    const { error: uErr } = await supabase.auth.updateUser({ password: pw1 });
    if (uErr) { setStage("idle"); setErr(uErr.message); return; }

    const { error: pErr } = await supabase.from("profiles").update({ force_password_change: false }).eq("id", uid);
    if (pErr) { setStage("idle"); setErr(pErr.message); return; }

    setStage("success");
    await new Promise(r => setTimeout(r, 2200));
    router.replace("/pos");
  }

  return (
    <div
      className="relative min-h-screen overflow-hidden flex items-center justify-center p-4"
      style={{
        fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
        background: "radial-gradient(ellipse 120% 80% at 50% -10%, rgba(192,57,43,0.07) 0%, transparent 60%), #f8fafc",
      }}
    >
      {/* Subtle grid */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.025]"
        style={{
          backgroundImage: "linear-gradient(#c0392b 1px, transparent 1px), linear-gradient(90deg, #c0392b 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
        aria-hidden
      />

      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-sm bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.08)] overflow-hidden"
      >
        {/* Confetti on success */}
        <AnimatePresence>
          {stage === "success" && (
            <div className="absolute inset-0 pointer-events-none z-10 overflow-hidden">
              {CONFETTI.map(c => <Confetti key={c.id} {...c} />)}
            </div>
          )}
        </AnimatePresence>

        {/* Top stripe */}
        <div className="h-1 w-full bg-gradient-to-r from-[#c0392b] via-[#e74c3c] to-[#c0392b]" />

        <div className="p-7">
          {/* Header */}
          <div className="flex items-center gap-3 mb-8">
            <div className="h-10 w-10 rounded-xl overflow-hidden border border-slate-100 shadow-sm flex-shrink-0">
              <img src="/logo/logo.svg" alt="Fresh Work" className="h-full w-full object-contain" />
            </div>
            <div>
              <p className="text-sm font-bold text-slate-900">Fresh Work</p>
              <p className="text-[10px] text-slate-400">Staff Portal</p>
            </div>
          </div>

          {/* Title area */}
          <AnimatePresence mode="wait">
            {stage === "success" ? (
              <motion.div
                key="success-title"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-center mb-8"
              >
                <motion.div
                  initial={{ scale: 0, rotate: -20 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.1 }}
                  className="text-5xl mb-4"
                >
                  🏆
                </motion.div>
                <h1 className="text-2xl font-black text-slate-900 tracking-tight">Password set!</h1>
                <p className="text-sm text-slate-400 mt-1">Heading to the POS now…</p>
              </motion.div>
            ) : (
              <motion.div
                key="form-title"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="mb-6"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-lg">🔐</span>
                  <h1 className="text-2xl font-black text-slate-900 tracking-tight">New password</h1>
                </div>
                <p className="text-sm text-slate-400">This is your first login — set a secure password to continue.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {stage !== "success" && (
            <>
              {/* New password field */}
              <div className="space-y-3 mb-4">
                <motion.div animate={{ scale: focused === "pw1" ? 1.01 : 1 }} transition={{ duration: 0.15 }}>
                  <div className={[
                    "flex items-center gap-3 rounded-2xl border bg-slate-50 focus-within:bg-white px-4 py-3.5 transition-all duration-200",
                    focused === "pw1"
                      ? "border-[#c0392b]/40 ring-2 ring-[#c0392b]/10 shadow-sm"
                      : "border-slate-200",
                  ].join(" ")}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={focused === "pw1" ? "text-[#c0392b]" : "text-slate-300"} style={{ transition: "color 0.2s" }}>
                      <rect x="2" y="6" width="11" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.3"/>
                      <path d="M4.5 6V4.5C4.5 3.119 5.619 2 7 2H8C9.381 2 10.5 3.119 10.5 4.5V6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
                    </svg>
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                      placeholder="New password"
                      type={showPw1 ? "text" : "password"}
                      value={pw1}
                      onChange={e => { setPw1(e.target.value); setErr(null); }}
                      onFocus={() => setFocused("pw1")}
                      onBlur={() => setFocused(null)}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPw1(v => !v)} className="text-slate-300 hover:text-slate-500 transition-colors" tabIndex={-1}>
                      {showPw1
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3.5 3 7 3C10.5 3 13 7 13 7C13 7 10.5 11 7 11C3.5 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.2"/><path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3.5 3 7 3C10.5 3 13 7 13 7C13 7 10.5 11 7 11C3.5 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.2"/></svg>
                      }
                    </button>
                  </div>
                </motion.div>

                {/* Strength bar */}
                <AnimatePresence>
                  {pw1.length > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="overflow-hidden"
                    >
                      <div className="px-1">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[10px] text-slate-400 font-medium">Strength</span>
                          <motion.span
                            key={strength.label}
                            initial={{ opacity: 0, x: 4 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.15 }}
                            className="text-[10px] font-bold"
                            style={{ color: strength.color }}
                          >
                            {strength.label}
                          </motion.span>
                        </div>
                        <div className="flex gap-1">
                          {[1, 2, 3, 4].map(i => (
                            <div key={i} className="flex-1 h-1 rounded-full overflow-hidden bg-slate-100">
                              <motion.div
                                className="h-full rounded-full"
                                animate={{ width: strength.score >= i ? "100%" : "0%" }}
                                transition={{ duration: 0.25, delay: i * 0.05 }}
                                style={{ background: strength.color }}
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Confirm password */}
                <motion.div animate={{ scale: focused === "pw2" ? 1.01 : 1 }} transition={{ duration: 0.15 }}>
                  <div className={[
                    "flex items-center gap-3 rounded-2xl border bg-slate-50 focus-within:bg-white px-4 py-3.5 transition-all duration-200",
                    focused === "pw2"
                      ? "border-[#c0392b]/40 ring-2 ring-[#c0392b]/10 shadow-sm"
                      : match
                      ? "border-emerald-300"
                      : pw2.length > 0
                      ? "border-[#c0392b]/30"
                      : "border-slate-200",
                  ].join(" ")}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" className={match ? "text-emerald-500" : focused === "pw2" ? "text-[#c0392b]" : "text-slate-300"} style={{ transition: "color 0.2s" }}>
                      <path d="M2 7.5L5.5 11L13 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    <input
                      className="flex-1 bg-transparent text-sm text-slate-900 placeholder-slate-400 outline-none"
                      placeholder="Confirm new password"
                      type={showPw2 ? "text" : "password"}
                      value={pw2}
                      onChange={e => { setPw2(e.target.value); setErr(null); }}
                      onFocus={() => setFocused("pw2")}
                      onBlur={() => setFocused(null)}
                    />
                    <button type="button" onClick={() => setShowPw2(v => !v)} className="text-slate-300 hover:text-slate-500 transition-colors" tabIndex={-1}>
                      {showPw2
                        ? <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3.5 3 7 3C10.5 3 13 7 13 7C13 7 10.5 11 7 11C3.5 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.2"/><path d="M2 2L12 12" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        : <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 7C1 7 3.5 3 7 3C10.5 3 13 7 13 7C13 7 10.5 11 7 11C3.5 11 1 7 1 7Z" stroke="currentColor" strokeWidth="1.2"/><circle cx="7" cy="7" r="1.75" stroke="currentColor" strokeWidth="1.2"/></svg>
                      }
                    </button>
                    {match && (
                      <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500 }} className="flex-shrink-0">
                        <span className="h-4 w-4 rounded-full bg-emerald-500 flex items-center justify-center">
                          <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      </motion.span>
                    )}
                  </div>
                </motion.div>
              </div>

              {/* Rules checklist */}
              <AnimatePresence>
                {pw1.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden mb-4"
                  >
                    <div className="rounded-2xl bg-slate-50 border border-slate-100 p-3.5 space-y-2">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Requirements</p>
                      {RULES.map((r, i) => (
                        <motion.div
                          key={i}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-2.5"
                        >
                          <motion.div
                            animate={{
                              background: rulesPass[i] ? "#10B981" : "#e2e8f0",
                              scale: rulesPass[i] ? [1, 1.2, 1] : 1,
                            }}
                            transition={{ duration: 0.2 }}
                            className="h-4 w-4 rounded-full flex items-center justify-center flex-shrink-0"
                          >
                            {rulesPass[i] && (
                              <motion.svg
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ type: "spring", stiffness: 600, damping: 25 }}
                                width="8" height="8" viewBox="0 0 8 8" fill="none"
                              >
                                <path d="M1.5 4L3 5.5L6.5 2" stroke="white" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                              </motion.svg>
                            )}
                          </motion.div>
                          <span className={["text-xs transition-colors", rulesPass[i] ? "text-emerald-700 font-medium" : "text-slate-500"].join(" ")}>
                            {r.label}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Error */}
              <AnimatePresence>
                {err && (
                  <motion.div
                    key="err"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.18 }}
                    className="overflow-hidden mb-3"
                  >
                    <div className="rounded-xl bg-[#FFF0EE] border border-[#c0392b]/20 px-3.5 py-3 flex items-start gap-2">
                      <svg width="13" height="13" viewBox="0 0 13 13" fill="none" className="text-[#c0392b] flex-shrink-0 mt-px"><circle cx="6.5" cy="6.5" r="5.5" stroke="currentColor" strokeWidth="1.2"/><path d="M6.5 4V6.5M6.5 9H6.51" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                      <p className="text-xs text-[#c0392b]">{err}</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Submit */}
              <motion.button
                whileTap={canSubmit ? { scale: 0.98 } : {}}
                onClick={submit}
                disabled={!canSubmit}
                className={[
                  "relative w-full rounded-2xl py-3.5 text-sm font-bold transition-all duration-300 overflow-hidden",
                  canSubmit
                    ? "bg-[#c0392b] text-white hover:bg-[#a93226] shadow-[0_4px_16px_rgba(192,57,43,0.3)]"
                    : "bg-slate-100 text-slate-400 cursor-not-allowed",
                ].join(" ")}
              >
                {stage === "loading" && (
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                    animate={{ x: ["-100%", "100%"] }}
                    transition={{ duration: 0.8, repeat: Infinity }}
                  />
                )}
                <span className="relative flex items-center justify-center gap-2">
                  {stage === "loading" ? (
                    <>
                      <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                      Setting password…
                    </>
                  ) : (
                    <>
                      Set password
                      {canSubmit && (
                        <motion.span animate={{ x: [0, 3, 0] }} transition={{ duration: 1.4, repeat: Infinity }}>→</motion.span>
                      )}
                    </>
                  )}
                </span>
              </motion.button>

              <p className="mt-4 text-center text-[11px] text-slate-400">
                You can change it again anytime in settings.
              </p>
            </>
          )}
        </div>

        {/* Loading bar */}
        {stage === "loading" && (
          <motion.div
            className="absolute bottom-0 left-0 h-0.5 bg-[#c0392b]"
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 1.5, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}