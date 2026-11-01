import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { MapPin, Search } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CATEGORIES, PRICE_RANGES, STATES } from "@/lib/listings";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RentReady — Find a Place in Lagos & Nigeria Without an Agent" },
      { name: "description", content: "Rent or buy apartments, houses, shops, offices, event halls and land across Lagos, Abuja and Nigeria. Talk to owners directly. Owners post at their own price." },
      { property: "og:title", content: "RentReady — Discover. Connect. Secure Your Space." },
      { property: "og:description", content: "No agent needed. Find and post properties across Nigeria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function Index() {
  const navigate = useNavigate();
  const [loc, setLoc] = useState("");
  const [state, setState] = useState("");
  const [cat, setCat] = useState("");
  const [range, setRange] = useState(0);

  function search(e: React.FormEvent) {
    e.preventDefault();
    const r = PRICE_RANGES[range] ?? PRICE_RANGES[0];
    navigate({ to: "/listings", search: { q: loc || undefined, state: state || undefined, category: cat || undefined, min: r.min, max: r.max } });
  }

  const field = "w-full bg-transparent text-sm outline-none";
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="relative flex flex-1 flex-col overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Modern apartment building in Lagos at dusk" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <SiteHeader overlay />
        <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 pb-16 pt-12 lg:pt-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
            Find your next space in <span className="text-brand">Lagos & across Nigeria</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-ink-foreground/85 md:text-lg">
            Apartments, houses, shops, offices, event halls and land — talk straight to the owner. No agent, no agency fee.
          </p>
          <p className="pointer-events-none absolute right-8 top-24 hidden -rotate-6 font-script text-5xl text-ink-foreground/90 xl:block">Your Space. Your Choice.</p>

          <form onSubmit={search} className="mt-10 grid max-w-5xl gap-3 rounded-2xl bg-card p-3 text-card-foreground shadow-card md:grid-cols-[1.2fr_1fr_1fr_1fr_auto]">
            <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-2">
              <MapPin className="h-5 w-5 text-brand" />
              <span className="flex-1"><span className="block text-xs font-medium">Area</span>
                <input value={loc} onChange={(e) => setLoc(e.target.value)} placeholder="e.g. Lekki, Yaba, Wuse" className={field} /></span>
            </label>
            <label className="rounded-xl border border-border px-4 py-2"><span className="block text-xs font-medium">State</span>
              <select value={state} onChange={(e) => setState(e.target.value)} className={field}><option value="">All Nigeria</option>{STATES.map((s) => <option key={s}>{s}</option>)}</select></label>
            <label className="rounded-xl border border-border px-4 py-2"><span className="block text-xs font-medium">Property Type</span>
              <select value={cat} onChange={(e) => setCat(e.target.value)} className={field}><option value="">All Types</option>{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</select></label>
            <label className="rounded-xl border border-border px-4 py-2"><span className="block text-xs font-medium">Price Range</span>
              <select value={range} onChange={(e) => setRange(Number(e.target.value))} className={field}>{PRICE_RANGES.map((r, i) => <option key={r.label} value={i}>{r.label}</option>)}</select></label>
            <button type="submit" className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 font-medium text-primary-foreground hover:opacity-90"><Search className="h-4 w-4" /> Search</button>
          </form>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
