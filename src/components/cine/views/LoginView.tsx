"use client";
// Premium Cinema-Themed Authentication (Firebase Auth + Google Sign-In + Demo Accounts).
import { useEffect, useState } from "react";
import { navigate } from "@/lib/router";
import { api } from "@/lib/client";
import { useAuth } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Clapperboard,
  Info,
  Eye,
  EyeOff,
  Flame,
  ShieldCheck,
  Sparkles,
  Lock,
  Mail,
  User,
  Phone,
  CheckCircle2,
} from "lucide-react";
import {
  isFirebaseConfigured,
  signInWithGoogle,
  loginWithEmail,
  registerWithEmail,
  resetPassword,
} from "@/lib/firebase";

const DEMO_ACCOUNTS = [
  { email: "customer@cine360.demo", label: "Customer", desc: "Book seats, 3D seat vision, QR tickets" },
  { email: "owner@cine360.demo", label: "Theatre Owner", desc: "Frost Cinemas · screens, shows, analytics" },
  { email: "owner2@cine360.demo", label: "Owner #2 (Pending)", desc: "Flame Multiplex · pending approval flow" },
  { email: "staff@cine360.demo", label: "Gate Staff", desc: "Frost Cinemas · QR ticket scanner" },
  { email: "admin@cine360.demo", label: "Super Admin", desc: "Platform approvals, refunds, audit logs" },
];
const DEMO_PASSWORD = "Demo@1234";

export default function LoginView({ mode }: { mode: "login" | "register" }) {
  const { loadSession } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  // Forgot password dialog
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotBusy, setForgotBusy] = useState(false);

  const fbReady = isFirebaseConfigured();

  useEffect(() => {
    setPassword("");
    setConfirmPassword("");
  }, [mode]);

  const handleSuccessfulAuth = async () => {
    await loadSession();
    const back = sessionStorage.getItem("c360_return");
    sessionStorage.removeItem("c360_return");
    navigate(back && back.startsWith("#/") ? back.slice(1) : "/");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "register") {
      if (password !== confirmPassword) {
        toast.error("Passwords do not match");
        return;
      }
      if (!agreeTerms) {
        toast.error("Please accept the Terms & Conditions to register");
        return;
      }
    }

    setBusy(true);
    try {
      if (fbReady) {
        // 1. Try Firebase Authentication first
        try {
          let fbUser;
          if (mode === "login") {
            fbUser = await loginWithEmail(email, password);
          } else {
            fbUser = await registerWithEmail(email, password, name);
          }
          const idToken = await fbUser.getIdToken();
          localStorage.setItem("c360_fb_token", idToken);

          // Sync with backend
          await api.post("/api/auth/firebase-sync", {
            idToken,
            name: mode === "register" ? name : fbUser.displayName,
            phone: phone || undefined,
          });

          toast.success(mode === "login" ? "Welcome back!" : "Account created successfully!");
          await handleSuccessfulAuth();
          return;
        } catch (fbErr: any) {
          // If the email is a demo account, or if user credentials exist in DB, fallback gracefully
          const isDemo = DEMO_ACCOUNTS.some((d) => d.email === email);
          if (!isDemo && fbErr?.message) {
            throw new Error(fbErr.message.replace("Firebase: ", ""));
          }
        }
      }

      // 2. Direct Backend fallback (used for demo accounts or when Firebase is in hybrid/offline mode)
      if (mode === "login") {
        await api.post("/api/auth/login", { email, password });
        toast.success("Welcome back!");
      } else {
        await api.post("/api/auth/register", { name, email, phone: phone || undefined, password });
        toast.success("Account created — you are signed in.");
      }
      await handleSuccessfulAuth();
    } catch (err: any) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (!fbReady) {
      toast.info("Google Sign-In requires Firebase configuration in .env. Use demo accounts or email sign-in for instant access.");
      return;
    }
    setBusy(true);
    try {
      const user = await signInWithGoogle();
      const idToken = await user.getIdToken();
      localStorage.setItem("c360_fb_token", idToken);

      await api.post("/api/auth/firebase-sync", {
        idToken,
        name: user.displayName || undefined,
      });

      toast.success(`Welcome, ${user.displayName || "Cinema Fan"}!`);
      await handleSuccessfulAuth();
    } catch (err: any) {
      toast.error(err?.message ? err.message.replace("Firebase: ", "") : "Google Sign-In was cancelled or failed");
    } finally {
      setBusy(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;
    setForgotBusy(true);
    try {
      if (fbReady) {
        await resetPassword(forgotEmail);
        toast.success("Password reset email sent! Check your inbox.");
      } else {
        toast.info("Password reset request recorded for " + forgotEmail);
      }
      setForgotOpen(false);
    } catch (err: any) {
      toast.error(err?.message ? err.message.replace("Firebase: ", "") : "Failed to send reset email");
    } finally {
      setForgotBusy(false);
    }
  };

  const fillDemo = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    if (mode === "register") {
      setName("Demo User");
      setConfirmPassword(DEMO_PASSWORD);
      setAgreeTerms(true);
    }
    toast.info(`Loaded ${demoEmail}`);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-12 grid lg:grid-cols-2 gap-10 items-start">
      {/* Authentication Card */}
      <div className="cine-card p-8 rounded-2xl border border-white/10 bg-[#120A1C]/90 shadow-2xl relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-64 h-64 bg-[#8B5CF6]/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2.5">
            <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#8B5CF6] via-[#D97706] to-[#F59E0B] flex items-center justify-center shadow-lg shadow-[#8B5CF6]/20">
              <Clapperboard className="w-5 h-5 text-white" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">
                {mode === "login" ? "Welcome to CINE 360" : "Create CINE 360 Account"}
              </h1>
              <p className="text-xs text-[#94A3B8]">Experience Your Seat Before You Book.</p>
            </div>
          </div>
          {fbReady ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#10B981]/15 text-[#34D399] border border-[#10B981]/30">
              <ShieldCheck className="w-3.5 h-3.5" /> Firebase Live
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#F59E0B]/15 text-[#FBBF24] border border-[#F59E0B]/30">
              <Sparkles className="w-3.5 h-3.5" /> Demo Mode
            </span>
          )}
        </div>

        {/* Google Sign-In Button */}
        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={busy}
          className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] text-white text-sm font-medium transition-all cursor-pointer group shadow-sm disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continue with Google</span>
        </button>

        <div className="relative my-6 text-center">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <span className="relative bg-[#120A1C] px-3 text-xs text-[#94A3B8] uppercase tracking-wider">
            Or with email &amp; password
          </span>
        </div>

        <form onSubmit={submit} className="space-y-4">
          {mode === "register" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="name" className="text-xs text-[#CBD5E1] font-medium flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-[#8B5CF6]" /> Full Name
                </Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  minLength={2}
                  placeholder="e.g. Maya Sharma"
                  className="bg-[#180E28] border-white/10 text-white placeholder:text-[#64748B] focus:border-[#F59E0B] h-11"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="phone" className="text-xs text-[#CBD5E1] font-medium flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#8B5CF6]" /> Phone Number (Optional)
                </Label>
                <Input
                  id="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="bg-[#180E28] border-white/10 text-white placeholder:text-[#64748B] focus:border-[#F59E0B] h-11"
                />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="email" className="text-xs text-[#CBD5E1] font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-[#8B5CF6]" /> Email Address
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="bg-[#180E28] border-white/10 text-white placeholder:text-[#64748B] focus:border-[#F59E0B] h-11"
              autoComplete="username"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-xs text-[#CBD5E1] font-medium flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#8B5CF6]" /> Password
              </Label>
              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => {
                    setForgotEmail(email);
                    setForgotOpen(true);
                  }}
                  className="text-xs text-[#F59E0B] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              )}
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === "register" ? 8 : 1}
                placeholder={mode === "register" ? "At least 8 characters" : "Your password"}
                className="bg-[#180E28] border-white/10 text-white placeholder:text-[#64748B] focus:border-[#F59E0B] pr-10 h-11"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-white cursor-pointer"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === "register" && (
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword" className="text-xs text-[#CBD5E1] font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#8B5CF6]" /> Confirm Password
              </Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                placeholder="Re-enter your password"
                className="bg-[#180E28] border-white/10 text-white placeholder:text-[#64748B] focus:border-[#F59E0B] h-11"
                autoComplete="new-password"
              />
            </div>
          )}

          {mode === "login" ? (
            <div className="flex items-center gap-2 pt-1">
              <Checkbox
                id="remember"
                checked={rememberMe}
                onCheckedChange={(v) => setRememberMe(Boolean(v))}
                className="border-white/20 data-[state=checked]:bg-[#F59E0B] data-[state=checked]:border-[#F59E0B]"
              />
              <label htmlFor="remember" className="text-xs text-[#94A3B8] cursor-pointer">
                Remember me on this browser
              </label>
            </div>
          ) : (
            <div className="flex items-start gap-2 pt-1">
              <Checkbox
                id="terms"
                checked={agreeTerms}
                onCheckedChange={(v) => setAgreeTerms(Boolean(v))}
                className="border-white/20 mt-0.5 data-[state=checked]:bg-[#F59E0B] data-[state=checked]:border-[#F59E0B]"
              />
              <label htmlFor="terms" className="text-xs text-[#94A3B8] cursor-pointer leading-relaxed">
                I agree to the <span className="text-[#CBD5E1] underline">Terms of Service</span> and{" "}
                <span className="text-[#CBD5E1] underline">Privacy Policy</span>.
              </label>
            </div>
          )}

          <Button
            type="submit"
            disabled={busy}
            className="w-full bg-gradient-to-r from-[#8B5CF6] via-[#D97706] to-[#F59E0B] hover:opacity-95 text-white font-semibold h-11 rounded-xl shadow-lg shadow-[#F59E0B]/20 transition-all cursor-pointer"
          >
            {busy ? "Authenticating…" : mode === "login" ? "Sign In to CINE 360" : "Create My Account"}
          </Button>
        </form>

        <p className="text-sm text-[#94A3B8] mt-6 text-center">
          {mode === "login" ? (
            <>
              New to CINE 360?{" "}
              <button
                onClick={() => navigate("/register")}
                className="text-[#F59E0B] font-semibold hover:underline cursor-pointer"
              >
                Create an account
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => navigate("/login")}
                className="text-[#F59E0B] font-semibold hover:underline cursor-pointer"
              >
                Sign in here
              </button>
            </>
          )}
        </p>
      </div>

      {/* Demo Credentials Panel */}
      <div className="cine-card p-8 rounded-2xl border border-white/10 bg-[#120A1C]/90 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <span className="w-8 h-8 rounded-lg bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center text-[#F59E0B]">
            <Flame className="w-4 h-4" />
          </span>
          <h2 className="text-lg font-bold text-white">Interactive Demo Personas</h2>
        </div>
        <p className="text-xs text-[#94A3B8] leading-relaxed mb-6">
          Explore all role consoles directly. Every demo account uses the shared password{" "}
          <code className="px-2 py-0.5 rounded bg-[#1C112E] border border-white/10 text-[#F59E0B] font-mono text-xs">
            Demo@1234
          </code>
          . Click any card to auto-populate credentials.
        </p>

        <div className="space-y-3">
          {DEMO_ACCOUNTS.map((d) => (
            <button
              key={d.email}
              type="button"
              onClick={() => fillDemo(d.email)}
              className="w-full text-left p-3.5 rounded-xl border border-white/10 bg-white/[0.02] hover:bg-[#8B5CF6]/10 hover:border-[#F59E0B]/50 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-white group-hover:text-[#F59E0B] transition-colors">
                  {d.label}
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8]">{d.email}</span>
              </div>
              <div className="text-xs text-[#94A3B8]">{d.desc}</div>
            </button>
          ))}
        </div>

        <div className="mt-6 pt-5 border-t border-white/10 flex items-center justify-between text-xs text-[#94A3B8]">
          <span>Single-click fill supported</span>
          <span className="text-[#CBD5E1]">Role-Based Access Protected</span>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="bg-[#160D24] border-white/10 text-white sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-[#F59E0B]" /> Reset Password
            </DialogTitle>
            <DialogDescription className="text-[#94A3B8] text-xs">
              Enter your account email address. If Firebase Authentication is configured, we will send an official password reset link.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="forgot-email" className="text-xs text-[#CBD5E1]">
                Email Address
              </Label>
              <Input
                id="forgot-email"
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                placeholder="name@example.com"
                className="bg-[#1E1232] border-white/10 text-white"
              />
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setForgotOpen(false)}
                className="border-white/10 text-[#94A3B8]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={forgotBusy}
                className="bg-[#F59E0B] hover:bg-[#D97706] text-black font-semibold"
              >
                {forgotBusy ? "Sending…" : "Send Reset Link"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
