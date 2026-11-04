import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Search, ShieldCheck, UserPlus } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How RentReady Works" },
      { name: "description", content: "Create an account, get verified, list or discover properties, and connect safely." },
      { property: "og:title", content: "How RentReady Works" },
      { property: "og:description", content: "Sign up, get verified, list or discover, connect." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: How,
});

const steps = [
  { icon: UserPlus, t: "Create an account", d: "Choose Landlord / Property Owner or Buyer / Tenant, and confirm your email." },
  { icon: ShieldCheck, t: "Complete verification", d: "Landlords submit a government ID (passport, NIN or driver's licence). Approved accounts show a verified identity badge. Identity checks do not prove legal ownership of a property." },
  { icon: Search, t: "List or discover", d: "Owners post for free at their own price; every listing is reviewed before it goes live. Seekers filter by state, area, type and budget." },
  { icon: MessageCircle, t: "Connect safely", d: "Send private messages and request viewings without exposing phone numbers. Report anything suspicious." },
];

function How() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h1 className="text-4xl font-bold">How RentReady works</h1>
        <p className="mt-2 text-muted-foreground">Create an account, complete verification, list or discover properties, and connect with interested parties.</p>
        <div className="mt-10 grid gap-6 sm:grid-cols-2">
          {steps.map(({ icon: I, t, d }, i) => (
            <div key={t} className="rounded-xl border border-border bg-card p-6 shadow-card">
              <span className="grid h-12 w-12 place-items-center rounded-full bg-brand-soft text-primary"><I /></span>
              <h2 className="mt-4 text-xl font-semibold">{i + 1}. {t}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to="/listings" className="rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground">Find a place</Link>
          <Link to="/post" className="rounded-lg border border-primary px-6 py-3 font-medium text-primary">Post a property</Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
