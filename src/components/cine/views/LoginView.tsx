"use client";
// Login / Register with clearly labelled demo accounts.
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Clapperboard, Info } from "lucide-react";

const DEMO_ACCOUNTS = [
  { email: "customer@cine360.demo", label: "Customer", desc: "Book seats, hold, pay (test), own QR tickets" },
  { email: "owner@cine360.demo", label: "Theatre Owner", desc: "Frost Cinemas · dashboards, builder, shows" },
  { email: "owner2@cine360.demo", label: "Owner #2", desc: "Flame Multiplex · pending approval demo" },
  { email: "staff@cine360.demo", label: "Gate Staff", desc: "Frost Cinemas · QR ticket scanner" },
  { email: "admin@cine360.demo", label: "Super Admin", desc: "Platform approvals, refunds, settings" },
];
const DEMO_PASSWORD = "Demo@1234";

export default function LoginView({ mode }: { mode: "login" | "register" }) {
  const { loadSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setPassword("");
  }, [mode]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "login") {
        await api.post("/api/auth/login", { email, password });
        toast.success("Welcome back!");
      } else {
        await api.post("/api/auth/register", { name, email, phone: phone || undefined, password });
        toast.success("Account created — you are signed in.");
      }
      await loadSession();
      const back = sessionStorage.getItem("c360_return");
      sessionStorage.removeItem("c360_return");
      navigate(back && back.startsWith("#/") ? back.slice(1) : "/");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10 items-start">
      <div className="cine-card p-8">
        <div className="flex items-center gap-2.5 mb-6">
          <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#477BFF] to-[#20D9E8] flex items-center justify-center">
            <Clapperboard className="w-5 h-5 text-white" />
          </span>
          <h1 className="text-2xl font-bold">{mode === "login" ? "Sign in to CINE 360" : "Create your account"}</h1>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required minLength={2} placeholder="Riya Kumar" className="bg-[#0B0D12]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone">Phone (optional)</Label>
                <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91 98xxx" className="bg-[#0B0D12]" />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@example.com" className="bg-[#0B0D12]" autoComplete="username" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={mode === "register" ? 8 : 1}
              placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
              className="bg-[#0B0D12]"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-[#477BFF] hover:bg-[#5C89FF] h-11">
            {busy ? "Please wait…" : mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <p className="text-sm text-[#8FA3BF] mt-5 text-center">
          {mode === "login" ? (
            <>New to CINE 360? <button onClick={() => navigate("/register")} className="text-[#477BFF] hover:underline cursor-pointer">Create an account</button></>
          ) : (
            <>Already registered? <button onClick={() => navigate("/login")} className="text-[#477BFF] hover:underline cursor-pointer">Sign in</button></>
          )}
        </p>
      </div>

      <div className="cine-card p-8">
        <h2 className="text-lg font-bold flex items-center gap-2"><Info className="w-5 h-5 text-[#F5C518]" /> Demo accounts</h2>
        <p className="text-sm text-[#8FA3BF] mt-1.5 mb-5">
          Every demo account is labelled and uses the shared password <code className="px-1.5 py-0.5 rounded bg-[#0B0D12] border border-white/10 text-[#20D9E8]">Demo@1234</code>. They authenticate through the real backend — no authorization is bypassed.
        </p>
        <ul className="space-y-2.5">
          {DEMO_ACCOUNTS.map((d) => (
            <li key={d.email}>
              <button
                onClick={() => fillDemo(d.email)}
                className="w-full text-left px-4 py-3 rounded-xl border border-white/10 hover:border-[#477BFF]/50 hover:bg-[#477BFF]/5 transition-colors cursor-pointer group"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold group-hover:text-white">{d.label}</span>
                  <span className="text-[11px] text-[#8FA3BF]">{d.email}</span>
                </div>
                <div className="text-xs text-[#8FA3BF] mt-0.5">{d.desc}</div>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[#8FA3BF]/70 mt-5">Click an account to fill the form, then press Sign in.</p>
      </div>
    </div>
  );
}
