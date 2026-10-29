import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/SiteHeader";
import skyscraper from "@/assets/skyscraper.jpg";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — RentReady" },
      { name: "description", content: "Request a password reset link for your RentReady account." },
      { property: "og:title", content: "Reset your password — RentReady" },
      { property: "og:description", content: "Request a password reset link for your RentReady account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const email = String(new FormData(e.currentTarget).get("email"));
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setSent(true);
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
              <p className="mt-2 text-sm text-muted-foreground">We sent you a password reset link. Open it to choose a new password and get back into your account.</p>
              <Link to="/auth" search={{ mode: "signin" }} className="mt-5 inline-block font-medium text-primary">Back to sign in</Link>
            </div>
          ) : (
            <>
              <h1 className="text-2xl font-bold">Forgot your password?</h1>
              <p className="mt-1 text-sm text-muted-foreground">Enter the email you signed up with and we'll send you a reset link.</p>
              <form onSubmit={onSubmit} className="mt-5 space-y-3">
                <input name="email" type="email" required placeholder="Email address" className={input} />
                <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
                  {busy ? "Sending…" : "Send reset link"}
                </button>
              </form>
              <p className="mt-5 text-center text-sm text-muted-foreground">
                Remembered it? <Link to="/auth" search={{ mode: "signin" }} className="font-medium text-primary">Sign in</Link>
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
