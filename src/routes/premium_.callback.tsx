import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { BadgeCheck, CircleAlert, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/premium_/callback")({ component: PremiumCallbackPage });

function PremiumCallbackPage() {
  const started = useRef(false);
  const [state, setState] = useState<{ status: "loading" | "success" | "failed"; message?: string }>({ status: "loading" });

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const callbackUrl = new URL(window.location.href);
    const reference = callbackUrl.searchParams.get("reference") ?? callbackUrl.searchParams.get("trxref");
    window.history.replaceState(window.history.state, "", callbackUrl.pathname);

    if (!reference) {
      setState({ status: "failed", message: "No payment reference was returned. Please check your dashboard or contact support." });
      return;
    }
    void supabase.functions.invoke("verify-tenant-premium", { body: { reference } }).then(({ data, error }) => {
      if (error || data?.success !== true) {
        setState({ status: "failed", message: data?.error || error?.message || "We could not confirm this payment. Please try again or contact support." });
        return;
      }
      setState({ status: "success" });
    }).catch((reason: unknown) => {
      setState({ status: "failed", message: reason instanceof Error ? reason.message : "We could not verify this payment." });
    });
  }, []);

  const successful = state.status === "success";
  return <div className="flex min-h-screen flex-col bg-background">
    <SiteHeader />
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-5 py-16">
      <section className="w-full rounded-2xl border border-border bg-card p-8 text-center shadow-card">
        {state.status === "loading" ? <Loader2 className="mx-auto h-10 w-10 animate-spin text-primary" aria-label="Verifying payment" />
          : successful ? <BadgeCheck className="mx-auto h-12 w-12 text-primary" />
            : <CircleAlert className="mx-auto h-12 w-12 text-destructive" />}
        <h1 className="mt-4 text-2xl font-bold">{state.status === "loading" ? "Confirming your payment…" : successful ? "Payment Successful" : "Payment Failed"}</h1>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{state.status === "loading" ? "Please wait while Paystack confirms your Tenant Premium subscription." : successful ? "Tenant Premium is active. Enjoy 24-hour early access and property alerts." : state.message}</p>
        {state.status !== "loading" && <Button asChild className="mt-6 w-full"><Link to="/dashboard">Back to dashboard</Link></Button>}
      </section>
    </main>
    <SiteFooter />
  </div>;
}
