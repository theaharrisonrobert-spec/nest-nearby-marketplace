import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/SiteHeader";
import hero from "@/assets/hero.jpg";

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

function AuthPage() {
  const { mode, next } = Route.useSearch();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const signup = mode === "signup";

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const email = String(f.get("email"));
    const password = String(f.get("password"));
    setBusy(true);
    if (signup) {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: window.location.origin, data: { full_name: f.get("name"), phone: f.get("phone") } },
      });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      setSent(true);
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setBusy(false);
      if (error) { toast.error(error.message); return; }
      toast.success("Welcome back!");
      navigate({ to: next ?? "/" });
    }
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    if (r.error) { toast.error("Google sign-in failed"); return; }
    if (r.redirected) return;
    navigate({ to: next ?? "/" });
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-10 sm:px-16">
        <Logo />
        {sent ? (
          <div className="mt-10">
            <h1 className="text-3xl font-bold">Check your email</h1>
            <p className="mt-2 text-muted-foreground">We sent a confirmation link. Click it to activate your account, then sign in.</p>
            <Link to="/auth" search={{ mode: "signin" }} onClick={() => setSent(false)} className="mt-6 inline-block text-primary">Go to sign in</Link>
          </div>
        ) : (
          <>
            <h1 className="mt-10 text-3xl font-bold">{signup ? "Create your account" : "Welcome back"}</h1>
            <p className="mt-2 text-muted-foreground">{signup ? "Post properties at your own price and talk to renters directly." : "Sign in to post and manage your listings."}</p>
            <button onClick={google} className="mt-6 w-full rounded-lg border border-border py-3 text-sm font-medium hover:bg-muted">Continue with Google</button>
            <div className="my-5 text-center text-xs text-muted-foreground">or with email</div>
            <form onSubmit={onSubmit} className="space-y-3">
              {signup && (
                <>
                  <input name="name" required placeholder="Full name" className={input} />
                  <input name="phone" required placeholder="Phone number (e.g. 0803…)" className={input} />
                </>
              )}
              <input name="email" type="email" required placeholder="Email address" className={input} />
              <input name="password" type="password" required minLength={6} placeholder="Password" className={input} />
              <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
                {busy ? "Please wait…" : signup ? "Sign Up" : "Sign In"}
              </button>
            </form>
            <p className="mt-6 text-sm text-muted-foreground">
              {signup ? "Already have an account? " : "New to RentReady? "}
              <Link to="/auth" search={{ mode: signup ? "signin" : "signup", next }} className="font-medium text-primary">{signup ? "Sign in" : "Create an account"}</Link>
            </p>
          </>
        )}
      </div>
      <div className="relative hidden lg:block">
        <img src={hero} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <p className="absolute bottom-16 left-12 max-w-sm font-script text-5xl text-ink-foreground">Real Spaces. Real Opportunities.</p>
      </div>
    </div>
  );
}
