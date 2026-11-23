import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthScene } from "@/components/AuthScene";

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
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) { toast.error("Enter the email address for your account"); return; }
    setBusy(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: new URL("/reset-password", window.location.origin).toString(),
      });
      if (error) { toast.error(error.message); return; }
      setSent(true);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not request a password reset link. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "h-12 w-full rounded-lg border border-border bg-white px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";
  return (
    <AuthScene>
      {sent ? <div>
        <h1 className="text-3xl font-bold text-foreground">Check your email</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">If an account uses that address, a password reset link is on its way. Check your inbox and spam folder.</p>
        <Link to="/auth" search={{ mode: "signin" }} className="mt-5 inline-block font-semibold text-primary hover:underline">Back to sign in</Link>
      </div> : <>
        <h1 className="text-3xl font-bold text-foreground">Reset your password</h1>
        <p className="mt-2 text-sm text-muted-foreground">Enter your RentReady email address and we’ll send a reset link.</p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label htmlFor="reset-email" className="block text-sm font-semibold text-foreground">Email Address *<input id="reset-email" name="email" autoComplete="email" type="email" required placeholder="Email address" className={`${input} mt-1.5 font-normal`} /></label>
          <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-primary font-semibold text-white hover:bg-primary/90 disabled:opacity-60">{busy ? "Sending…" : "Send reset link"}</button>
        </form>
        <p className="mt-5 text-sm text-muted-foreground">Remembered your password? <Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-primary hover:underline">Sign in</Link></p>
      </>}
    </AuthScene>
  );
}
