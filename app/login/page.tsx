"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarDays, Clapperboard, ClipboardList, Eye, EyeOff, Frame, LoaderCircle, Sparkles } from "lucide-react";
import ThemeToggle from "@/components/shell/ThemeToggle";

const FLOATING = [
  { icon: Clapperboard, label: "EVideo", pos: "top-[10%] left-[10%]", delay: "0s" },
  { icon: Sparkles, label: "AI Video", pos: "top-[18%] right-[12%]", delay: "1.2s" },
  { icon: Frame, label: "Frame", pos: "top-[30%] left-[38%]", delay: "2.4s" },
  { icon: CalendarDays, label: "Calendar", pos: "top-[40%] left-[8%]", delay: "0.6s" },
  { icon: ClipboardList, label: "RxPad", pos: "top-[46%] right-[16%]", delay: "1.8s" },
];

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not log in.");
        return;
      }
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
      router.refresh();
    } catch {
      setError("Can't reach the server. Check your internet.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <div className="relative hidden overflow-hidden bg-accent lg:block">
        <div className="absolute inset-0 opacity-25" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, rgba(255,255,255,.6) 1px, transparent 0)", backgroundSize: "24px 24px" }} />
        {FLOATING.map(({ icon: Icon, label, pos, delay }) => (
          <div key={label} className={`absolute ${pos} flex items-center gap-2 rounded-xl bg-white py-1.5 pr-3 pl-1.5 text-[13px] font-bold text-black shadow-lg`}
            style={{ animation: `float 6s ease-in-out ${delay} infinite` }}>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent text-white"><Icon className="h-4 w-4" /></span>
            {label}
          </div>
        ))}
        <div className="absolute bottom-8 left-8 max-w-md text-white">
          <h2 className="text-3xl leading-tight font-extrabold tracking-tight">Every project, one clear next step.</h2>
          <p className="mt-2 text-sm text-white/80">Projects, tasks and the design library for the whole team — simple enough to learn in a day.</p>
        </div>
        <style>{`@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-10px)}}`}</style>
      </div>

      {/* Form */}
      <div className="relative flex flex-col items-center justify-center px-6 py-10">
        <div className="absolute top-3 right-3"><ThemeToggle /></div>
        <div className="w-full max-w-xs">
          <div className="mb-6 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-[var(--accent-fg)]">
              <Clapperboard className="h-4.5 w-4.5" strokeWidth={2.4} />
            </span>
            <span className="text-base font-extrabold tracking-tight">Studio Desk</span>
          </div>
          <h1 className="text-2xl font-extrabold tracking-tight">Welcome back 👋</h1>
          <p className="mt-1 text-[13px] text-muted">Log in with the email and password your admin gave you.</p>

          <form onSubmit={submit} className="mt-6 space-y-3">
            <div>
              <label className="label" htmlFor="email">Email</label>
              <input id="email" type="email" autoComplete="email" required className="input !py-2" placeholder="you@company.com"
                value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div>
              <label className="label" htmlFor="password">Password</label>
              <div className="relative">
                <input id="password" type={show ? "text" : "password"} autoComplete="current-password" required className="input !py-2 !pr-10"
                  value={password} onChange={(e) => setPassword(e.target.value)} />
                <button type="button" onClick={() => setShow(!show)} className="icon-btn absolute top-1/2 right-1 !h-7 !w-7 -translate-y-1/2" aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            {error && <p className="animate-pop rounded-md bg-danger/10 px-2.5 py-1.5 text-xs font-medium text-danger">{error}</p>}
            <button className="btn-primary w-full !py-2" disabled={loading}>
              {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : "Log in"}
            </button>
          </form>
          <p className="mt-5 text-center text-xs text-muted">No account yet? Ask your admin to create one for you.</p>
        </div>
      </div>
    </div>
  );
}
