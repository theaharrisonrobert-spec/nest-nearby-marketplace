import { createFileRoute } from "@tanstack/react-router";
import { LifeBuoy, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — RentReady" }, { name: "description", content: "Get help with RentReady listings, payments, sign-in, and safety." }] }),
  component: SupportPage,
});

function SupportPage() {
  return <div className="min-h-screen bg-muted/40"><SiteHeader /><main className="mx-auto max-w-4xl px-5 py-12 sm:py-16">
    <div className="rounded-2xl bg-card p-7 shadow-card sm:p-10"><LifeBuoy className="h-9 w-9 text-primary" /><h1 className="mt-4 text-3xl font-bold">RentReady Support</h1><p className="mt-2 max-w-2xl text-muted-foreground">Start with the Support button at the bottom right. Our support bot will route the issue, give an immediate safety or account answer, and create a ticket if you ask for a person.</p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2"><article className="rounded-xl border border-border p-5"><h2 className="font-semibold">Property safety</h2><p className="mt-2 text-sm text-muted-foreground">Inspect in person, check ownership documents, and do not pay rent through RentReady.</p></article><article className="rounded-xl border border-border p-5"><h2 className="font-semibold">Sign-in help</h2><p className="mt-2 text-sm text-muted-foreground">Use Forgot password or request a new confirmation link from the sign-in page.</p></article><article className="rounded-xl border border-border p-5"><h2 className="font-semibold">Profile approval</h2><p className="mt-2 text-sm text-muted-foreground">New profiles are reviewed to reduce fake accounts. You can browse while approval is pending.</p></article><article className="rounded-xl border border-border p-5"><h2 className="flex items-center gap-2 font-semibold"><ShieldCheck className="h-4 w-4 text-primary" />No agent fees</h2><p className="mt-2 text-sm text-muted-foreground">Contact landlords directly and confirm all payment details before you pay a landlord.</p></article></div>
      <p className="mt-7 text-sm">Email us at <a className="font-semibold text-primary underline" href="mailto:rentreadyng@gmail.com">rentreadyng@gmail.com</a>.</p>
    </div>
  </main><SiteFooter /></div>;
}
