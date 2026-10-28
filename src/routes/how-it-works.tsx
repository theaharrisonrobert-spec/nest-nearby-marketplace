import { createFileRoute, Link } from "@tanstack/react-router";
import { MessageCircle, Search, ShieldCheck, Tag } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/how-it-works")({
  head: () => ({
    meta: [
      { title: "How RentReady Works — No Agent Needed" },
      { name: "description", content: "Find a home or space in Nigeria and talk directly to owners. Owners post at their own price." },
      { property: "og:title", content: "How RentReady Works" },
      { property: "og:description", content: "No agents. Owners set their price. Talk directly." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: How,
});

const steps = [
  { icon: Search, t: "Search your area", d: "Filter by state, city, type and budget — Lagos, Abuja, Port Harcourt, Ibadan and beyond." },
  { icon: MessageCircle, t: "Contact the owner", d: "Chat on WhatsApp or call the owner directly. No agent, no agency or inspection fees." },
  { icon: Tag, t: "Post at your price", d: "Owners create a free account and list any property with the price they choose." },
  { icon: ShieldCheck, t: "Stay safe", d: "Inspect in person and confirm documents before paying anything." },
];

function How() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-5xl px-5 py-14">
        <h1 className="text-4xl font-bold">How RentReady works</h1>
        <p className="mt-2 text-muted-foreground">A direct line between people looking for space and people who have it.</p>
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
