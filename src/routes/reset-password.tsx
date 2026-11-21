import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { AuthScene } from "@/components/AuthScene";

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
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) { toast.error(error.message); return; }
      toast.success("Password updated — you're signed in");
      await navigate({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not update your password. Request a new reset link and try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "h-12 w-full rounded-lg border border-slate-300 bg-white px-4 text-base text-slate-900 outline-none focus:border-[#2563EB] focus:ring-2 focus:ring-[#2563EB]/20";
  return (
    <AuthScene>
      <h1 className="text-3xl font-bold text-slate-900">Choose a new password</h1>
      <p className="mt-2 text-sm text-slate-600">Enter a new password to get back into your account.</p>
      <form onSubmit={onSubmit} className="mt-6 space-y-4">
        <label className="block text-sm font-semibold text-slate-800" htmlFor="new-password">New password<input id="new-password" name="password" type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1.5 font-normal`} /></label>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="confirm-password">Confirm new password<input id="confirm-password" name="confirm" type="password" autoComplete="new-password" required minLength={8} className={`${input} mt-1.5 font-normal`} /></label>
        <button type="submit" disabled={busy} className="h-12 w-full rounded-lg bg-[#2563EB] font-semibold text-white hover:bg-[#1D4ED8] disabled:opacity-60">{busy ? "Updating…" : "Update password"}</button>
      </form>
      <p className="mt-5 text-sm text-slate-600"><Link to="/auth" search={{ mode: "signin" }} className="font-semibold text-[#2563EB] hover:underline">Back to sign in</Link></p>
    </AuthScene>
  );
}
