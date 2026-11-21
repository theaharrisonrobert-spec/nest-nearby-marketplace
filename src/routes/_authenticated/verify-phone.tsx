import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/verify-phone")({
  head: () => ({ meta: [{ title: "Verify your phone — RentReady" }, { name: "description", content: "Verify your phone number to request property viewings on RentReady." }] }),
  component: VerifyPhonePage,
});

function toNigerianE164(value: string) {
  const digits = value.replace(/\D/g, "");
  if (/^0[789]\d{9}$/.test(digits)) return `+234${digits.slice(1)}`;
  if (/^234[789]\d{9}$/.test(digits)) return `+${digits}`;
  return "";
}

function VerifyPhonePage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [sent, setSent] = useState(false);
  const [verified, setVerified] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("phone, phone_verified_at").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.phone) setPhone(data.phone);
      setVerified(!!data?.phone_verified_at);
    });
  }, [user.id]);

  async function sendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formatted = toNigerianE164(phone);
    if (!formatted) { toast.error("Enter a valid Nigerian number, e.g. 0803…"); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ phone: formatted });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setPhone(formatted);
    setSent(true);
    toast.success("Verification code sent by SMS");
  }

  async function verifyCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!/^\d{6}$/.test(token)) { toast.error("Enter the 6-digit code from your SMS"); return; }
    setBusy(true);
    const { error } = await supabase.auth.verifyOtp({ phone, token, type: "phone_change" });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setVerified(true);
    toast.success("Phone number verified");
    await navigate({ to: "/dashboard", replace: true });
  }

  const input = "h-12 w-full rounded-lg border border-border bg-background px-4 text-sm outline-none focus:border-primary";
  return <div className="min-h-screen bg-muted/40"><SiteHeader /><main className="mx-auto max-w-xl px-5 py-12">
    <h1 className="text-3xl font-bold">Verify your phone</h1>
    <p className="mt-2 text-muted-foreground">A verified phone helps landlords and tenants arrange viewings directly and safely.</p>
    {verified ? <div className="mt-6 rounded-xl bg-card p-6 shadow-card"><p className="font-semibold text-primary">Your phone number is verified.</p><Link to="/dashboard" className="mt-3 inline-block text-sm text-primary underline">Return to dashboard</Link></div> : !sent ? (
      <form onSubmit={sendCode} className="mt-6 space-y-4 rounded-xl bg-card p-6 shadow-card">
        <label className="block text-sm font-medium" htmlFor="verify-phone-number">Nigerian phone number</label>
        <input id="verify-phone-number" type="tel" inputMode="tel" autoComplete="tel" required value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0803..." className={input} />
        <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? "Sending code…" : "Send SMS code"}</Button>
      </form>
    ) : (
      <form onSubmit={verifyCode} className="mt-6 space-y-4 rounded-xl bg-card p-6 shadow-card">
        <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to {phone}.</p>
        <input type="text" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} aria-label="SMS verification code" className={input} />
        <Button type="submit" disabled={busy} className="h-12 w-full">{busy ? "Verifying…" : "Verify phone"}</Button>
        <button type="button" onClick={() => setSent(false)} className="w-full text-sm text-primary underline">Change phone number</button>
      </form>
    )}
  </main><SiteFooter /></div>;
}
