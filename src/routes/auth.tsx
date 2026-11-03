import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { AuthScene } from "@/components/AuthScene";
import { Button } from "@/components/ui/button";
import { accountType as normalizeAccountType } from "@/lib/marketplace-rules";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/listings";
import { ArrowRight, Building2, Eye, EyeOff, KeyRound, LockKeyhole, Mail, UserRoundPlus } from "lucide-react";


export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: "signin" | "signup"; next?: string | undefined; type?: AccountType } => {
    const n = s["next"];
    return { mode: s["mode"] === "signup" ? "signup" : "signin", next: typeof n === "string" && n.startsWith("/") && !n.startsWith("//") ? n : undefined, type: s["type"] === "landlord" || s["type"] === "tenant" ? s["type"] : undefined };
  },
  head: () => ({
    meta: [
      { title: "Sign in or create an account — RentReady" },
      { name: "description", content: "Sign in to RentReady to post properties and manage your listings." },
      { property: "og:title", content: "Sign in — RentReady" },
      { property: "og:description", content: "Create your free RentReady account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

async function notifyAdmin(userId: string, kind: string, message: string) {
  await supabase.from("admin_notifications").insert({ user_id: userId, kind, message });
}

function AuthPage() {
  const { mode, next, type: selectedType } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signup = mode === "signup";
  const [accountType, setAccountType] = useState<AccountType | null>(selectedType ?? null);

  useEffect(() => { setAccountType(selectedType ?? null); }, [selectedType]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    if (signup) {
      if (!accountType) { setBusy(false); return; }
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: f.get("name"), phone: f.get("phone"), account_type: accountType ?? "tenant" } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setSent(true);
    } else {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      if (data.user) await notifyAdmin(data.user.id, "signin", `Sign in: ${data.user.email ?? email}`);
      toast.success("Welcome back!");
      navigate({ to: next ?? "/" });
    }
  }

  async function google() {
    if (signup && !accountType) { toast.error("Choose Landlord or Buyer / Tenant first"); return; }
    if (signup && accountType) sessionStorage.setItem("rr-signup-type", accountType);
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Google sign-in failed"); return; }
    if (r.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      const selected = sessionStorage.getItem("rr-signup-type");
      if (selected) {
        const { error } = await supabase.from("profiles").update({ account_type: normalizeAccountType(selected) }).eq("id", data.user.id);
        if (error) { toast.error(error.message); return; }
        sessionStorage.removeItem("rr-signup-type");
      }
      await notifyAdmin(data.user.id, "signin", `Sign in (Google): ${data.user.email ?? ""}`);
    }
    navigate({ to: next ?? "/" });
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  return (
    <AuthScene>
        <div className="grid grid-cols-2 border-b border-border" aria-label="Account options">
          <Button asChild variant="ghost" className={`h-14 rounded-none border-b-2 text-base ${!signup ? "border-primary text-primary" : "border-transparent bg-muted/50"}`}>
            <Link to="/auth" search={{ mode: "signin", next }} onClick={() => setSent(false)}><LockKeyhole /> Login</Link>
          </Button>
          <Button asChild variant="ghost" className={`h-14 rounded-none border-b-2 text-base ${signup ? "border-primary text-primary" : "border-transparent bg-muted/50"}`}>
            <Link to="/auth" search={{ mode: "signup", next }} onClick={() => setSent(false)}><UserRoundPlus /> Sign Up</Link>
          </Button>
        </div>
        <div className="p-6 sm:p-8">
          {sent ? (
            <div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link. Click it to activate your account, then sign in. After signing in you'll submit a valid ID (international passport, NIN, or driver's license) for approval before you can post.</p>
              <Link to="/auth" search={{ mode: "signin" }} onClick={() => setSent(false)} className="mt-5 inline-block font-medium text-primary">Go to sign in</Link>
            </div>
          ) : signup && !accountType ? (
            <div>
              <h1 className="text-2xl font-bold">Welcome to RentReady</h1>
              <p className="mt-1 text-sm text-muted-foreground">Choose the account that fits your next move.</p>
              <p className="mt-5 text-sm font-semibold">How would you like to use RentReady?</p>
              <div className="mt-3 space-y-3">
                {([
                  ["landlord", Building2, "List and manage your own properties."],
                  ["tenant", KeyRound, "Find a home, shop or space to rent or buy."],
                ] as const).map(([k, Icon, d]) => (
                  <Button variant="outline" key={k} onClick={() => setAccountType(k)} className="h-auto w-full justify-start gap-4 whitespace-normal p-4 text-left hover:border-primary hover:bg-brand-soft">
                    <Icon className="h-7 w-7 shrink-0 text-primary" />
                    <span><span className="block font-semibold">{ACCOUNT_TYPES[k].label}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                  </Button>
                ))}
              </div>
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
              <Button onClick={google} variant="outline" className="h-11 w-full"><span className="font-display text-lg font-bold text-primary" aria-hidden="true">G</span> Continue with Google</Button>
              <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Link to="/auth" search={{ mode: "signin", next }} className="font-medium text-primary">Sign in</Link></p>
            </div>
          ) : (
            <>
              {signup && accountType && (
                <Button variant="secondary" size="sm" onClick={() => setAccountType(null)} className="mb-3 text-primary">{ACCOUNT_TYPES[accountType].label} · change</Button>
              )}
              <h2 className="text-center text-3xl font-bold">{signup ? accountType === "landlord" ? "Landlord sign up" : "Buyer / Tenant sign up" : "Welcome Back!"}</h2>
              <p className="mb-6 mt-1 text-center text-muted-foreground">{signup ? "Your next move starts here." : "Sign in to access your account"}</p>
              <form onSubmit={onSubmit} className="space-y-3">
                {signup && (
                  <>
                    <input name="name" required placeholder="Full name" className={input} />
                    <input name="phone" required placeholder="Phone number (e.g. 0803…)" className={input} />
                  </>
                )}
                <div className="relative">
                  <Mail className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                  <input name="email" aria-label="Email address" autoComplete="email" type="email" required placeholder="Email address" className={`${input} pl-12`} />
                </div>
                <div className="relative">
                  <LockKeyhole className="pointer-events-none absolute left-4 top-3.5 h-5 w-5 text-muted-foreground" />
                  <input name="password" aria-label="Password" autoComplete={signup ? "new-password" : "current-password"} type={showPassword ? "text" : "password"} required minLength={6} placeholder="Enter your password" className={`${input} pl-12 pr-12`} />
                  <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-1.5 text-muted-foreground" aria-label={showPassword ? "Hide password" : "Show password"} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</Button>
                </div>
                {!signup && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary">Forgot password?</Link>
                  </div>
                )}
                <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
                  {busy ? "Please wait…" : signup ? "Sign Up" : "Log In"} <ArrowRight />
                </Button>
              </form>
              {signup && <p className="mt-3 text-xs text-muted-foreground">We confirm your email first. Landlords then submit an ID before publishing. See our <Link to="/privacy" className="underline">privacy policy</Link> and <Link to="/terms" className="underline">terms</Link>.</p>}
              <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground"><span className="h-px flex-1 bg-border" />or continue with<span className="h-px flex-1 bg-border" /></div>
              <Button onClick={google} variant="outline" className="h-11 w-full"><span className="font-display text-lg font-bold text-primary" aria-hidden="true">G</span> Continue with Google</Button>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {signup ? "Already have an account? " : "New to RentReady? "}
                <Link to="/auth" search={{ mode: signup ? "signin" : "signup", next }} className="font-medium text-primary">{signup ? "Sign in" : "Create an account"}</Link>
              </p>
            </>
          )}
        </div>
    </AuthScene>
  );
}
