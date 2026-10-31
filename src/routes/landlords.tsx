import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarClock, LayoutDashboard, MessageSquare, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { meta } from "@/components/InfoPage";

export const Route = createFileRoute("/landlords")({
  head: () => meta("For Landlords & Agents", "List with confidence. Manage with ease. Showcase properties and connect with serious buyers and tenants."),
  component: Landlords,
});

const FEATURES = [
  [LayoutDashboard, "Your own dashboard", "Track listings, review status, enquiries and viewings in one workspace."],
  [MessageSquare, "Private enquiries", "Talk to interested people without publishing your phone number."],
  [CalendarClock, "Inspection scheduling", "Accept, decline or suggest another time for viewing requests."],
  [ShieldCheck, "Trust badges", "Verified identity and verified agency badges help serious people choose you."],
] as const;

function Landlords() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <section className="bg-ink text-ink-foreground">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <div className="text-xs font-semibold tracking-widest text-brand">RENTREADY BUSINESS</div>
          <h1 className="mt-2 text-4xl font-bold md:text-5xl">List with Confidence. Manage with Ease.</h1>
          <p className="mt-4 max-w-2xl text-lg text-ink-foreground/80">Your Property Deserves the Right Audience.</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/auth" search={{ mode: "signup" }} className="rounded-lg bg-brand px-6 py-3 font-medium text-brand-foreground">Create a business account</Link>
            <Link to="/post" className="rounded-lg border border-ink-foreground/60 px-6 py-3 font-medium">Post a property</Link>
          </div>
        </div>
      </section>
      <div className="mx-auto max-w-5xl space-y-5 px-5 py-14 text-foreground/85">
        <p>RentReady empowers landlords, property owners, and real estate professionals with a modern platform to showcase properties, connect with serious buyers and tenants, and manage listings with confidence.</p>
        <p>From residential apartments and commercial shops to office spaces, land, and event venues, RentReady provides the tools you need to present your properties professionally and reach the right people.</p>
        <p>Create your account, complete verification, publish your listings, manage enquiries, and unlock greater visibility through featured promotions (coming soon). Posting is free.</p>
        <div className="grid gap-5 pt-6 sm:grid-cols-2">
          {FEATURES.map(([I, t, d]) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <I className="h-7 w-7 text-primary" />
              <h2 className="mt-3 font-semibold text-foreground">{t}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <p className="pt-6 text-center font-script text-2xl text-primary">RentReady — Connecting Properties, People, and Opportunities.</p>
      </div>
      <SiteFooter />
    </div>
  );
}
