import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/SiteHeader";
import skyscraper from "@/assets/skyscraper.jpg";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Choose a new password — RentReady" },
      { name: "description", content: "Set a new password for your RentReady account." },
      { property: "og:title", content: "Choose a new password — RentReady" },
      { property: "og:description", content: "Set a new password for your RentReady account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const password = String(f.get("password"));
    if (password !== String(f.get("confirm"))) { toast.error("Passwords do not match"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Password updated — you're signed in");
    navigate({ to: "/" });
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <img src={skyscraper} alt="" className="absolute inset-0 h-full w-full object-cover" />
      <div className="absolute inset-0 bg-ink/70" />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center"><Logo light /></div>
        <div className="rounded-2xl bg-card p-7 shadow-card sm:p-9">
          <h1 className="text-2xl font-bold">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted-foreground">Enter your new password below to regain access to your account.</p>
          <form onSubmit={onSubmit} className="mt-5 space-y-3">
            <input name="password" type="password" required minLength={6} placeholder="New password" className={input} />
            <input name="confirm" type="password" required minLength={6} placeholder="Confirm new password" className={input} />
            <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "Updating…" : "Update password"}
            </button>
          </form>
          <p className="mt-5 text-center text-sm text-muted-foreground">
            <Link to="/auth" search={{ mode: "signin" }} className="font-medium text-primary">Back to sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
