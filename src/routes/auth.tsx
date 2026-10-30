import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/SiteHeader";
import { ACCOUNT_TYPES, type AccountType } from "@/lib/listings";
import { Building2, Briefcase, KeyRound } from "lucide-react";
import skyscraper from "@/assets/skyscraper.jpg";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>): { mode: "signin" | "signup"; next?: string | undefined } => {
    const n = s["next"];
    return { mode: s["mode"] === "signup" ? "signup" : "signin", next: typeof n === "string" && n.startsWith("/") ? n : undefined };
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
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const signup = mode === "signup";
  const [accountType, setAccountType] = useState<AccountType | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    if (signup) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: f.get("name"), phone: f.get("phone"), account_type: accountType ?? "tenant", agency_name: f.get("agency") || null } },
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
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Google sign-in failed"); return; }
    if (r.redirected) return;
    const { data } = await supabase.auth.getUser();
    if (data.user) await notifyAdmin(data.user.id, "signin", `Sign in (Google): ${data.user.email ?? ""}`);
    navigate({ to: next ?? "/" });
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <img src={skyscraper} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/70" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo light /></div>
        <div className="rounded-2xl bg-card p-7 shadow-card sm:p-9">
          {sent ? (
            <div>
              <h1 className="text-2xl font-bold">Check your email</h1>
              <p className="mt-2 text-sm text-muted-foreground">We sent a confirmation link. Click it to activate your account, then sign in. After signing in you'll submit a valid ID (international passport, NIN, or driver's license) for approval before you can post.</p>
              <Link to="/auth" search={{ mode: "signin" }} onClick={() => setSent(false)} className="mt-5 inline-block font-medium text-primary">Go to sign in</Link>
            </div>
          ) : signup && !accountType ? (
            <div>
              <h1 className="text-2xl font-bold">Welcome to RentReady</h1>
              <p className="mt-1 text-sm text-muted-foreground">Join a trusted community for property rentals, sales, and investments.</p>
              <p className="mt-5 text-sm font-semibold">How would you like to use RentReady?</p>
              <div className="mt-3 space-y-3">
                {([
                  ["landlord", Building2, "List and manage your own properties."],
                  ["agent", Briefcase, "List properties for clients as an agent or agency."],
                  ["tenant", KeyRound, "Find a home, shop or space to rent or buy."],
                ] as const).map(([k, Icon, d]) => (
                  <button key={k} onClick={() => setAccountType(k)} className="flex w-full items-center gap-4 rounded-xl border border-border p-4 text-left transition hover:border-primary hover:bg-brand-soft">
                    <Icon className="h-7 w-7 shrink-0 text-primary" />
                    <span><span className="block font-semibold">{ACCOUNT_TYPES[k].label}</span><span className="text-xs text-muted-foreground">{d}</span></span>
                  </button>
                ))}
              </div>
              <p className="mt-5 text-center text-sm text-muted-foreground">Already have an account? <Link to="/auth" search={{ mode: "signin", next }} className="font-medium text-primary">Sign in</Link></p>
            </div>
          ) : (
            <>
              {signup && accountType && (
                <button onClick={() => setAccountType(null)} className="mb-3 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-primary">{ACCOUNT_TYPES[accountType].label} · change</button>
              )}
              <h1 className="text-2xl font-bold">{signup ? "Create your account" : "Welcome back"}</h1>
              <p className="mt-1 text-sm text-muted-foreground">{signup ? "Post properties at your own price and talk to renters directly." : "Sign in to post and manage your listings."}</p>
              <button onClick={google} className="mt-5 w-full rounded-lg border border-border py-3 text-sm font-medium hover:bg-muted">Continue with Google</button>
              <div className="my-4 text-center text-xs text-muted-foreground">or with email</div>
              <form onSubmit={onSubmit} className="space-y-3">
                {signup && (
                  <>
                    <input name="name" required placeholder="Full name" className={input} />
                    <input name="phone" required placeholder="Phone number (e.g. 0803…)" className={input} />
                    {accountType === "agent" && <input name="agency" required placeholder="Agency / business name" className={input} />}
                  </>
                )}
                <input name="email" type="email" required placeholder="Email address" className={input} />
                <input name="password" type="password" required minLength={6} placeholder="Password" className={input} />
                {!signup && (
                  <div className="text-right">
                    <Link to="/forgot-password" className="text-xs font-medium text-primary">Forgot password?</Link>
                  </div>
                )}
                <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
                  {busy ? "Please wait…" : signup ? "Sign Up" : "Sign In"}
                </button>
              </form>
              {signup && <p className="mt-3 text-xs text-muted-foreground">We confirm your email first. Landlords and agents then submit an ID before publishing. See our <Link to="/privacy" className="underline">privacy policy</Link> and <Link to="/terms" className="underline">terms</Link>.</p>}
              <p className="mt-5 text-center text-sm text-muted-foreground">
                {signup ? "Already have an account? " : "New to RentReady? "}
                <Link to="/auth" search={{ mode: signup ? "signin" : "signup", next }} className="font-medium text-primary">{signup ? "Sign in" : "Create an account"}</Link>
              </p>
            </>
          )}
        </div>
        <p className="mt-6 text-center font-script text-2xl text-ink-foreground">Real Spaces. Real Opportunities.</p>
      </div>
    </div>
  );
}
