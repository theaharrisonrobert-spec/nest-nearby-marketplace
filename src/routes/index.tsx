import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Search } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CATEGORIES, POPULAR_AREAS, STATES } from "@/lib/listings";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RentReady — Rent, Buy & List Property Across Nigeria" },
      { name: "description", content: "Find apartments, houses, shops, malls, office spaces, land and other spaces for rent or sale in Lagos, Abuja and every Nigerian state." },
      { property: "og:title", content: "RentReady — Rentals. Homes. Shops. Land." },
      { property: "og:description", content: "Search every state and area in Nigeria. Talk to owners directly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const AREA_OPTIONS = [
  ...POPULAR_AREAS.filter((a) => a.city).map((a) => `${a.city}, ${a.state}`),
  ...STATES,
];

function Index() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");

  function search(e: React.FormEvent) {
    e.preventDefault();
    const v = q.trim();
    const [city = "", st] = v.split(",").map((s) => s.trim());
    const stateMatch = STATES.find((s) => s.toLowerCase() === (st ?? city).toLowerCase());
    if (!v) void navigate({ to: "/listings" });
    else if (st && stateMatch) void navigate({ to: "/listings", search: { state: stateMatch, city } });
    else if (stateMatch) void navigate({ to: "/listings", search: { state: stateMatch } });
    else void navigate({ to: "/listings", search: { q: v } });
  }

  const cards = [
    { title: "Rent a home", text: "Apartments, flats and houses for rent — talk straight to the owner, no agency fee.", cta: "Find rentals", to: { to: "/listings" as const, search: { purpose: "rent" } } },
    { title: "Buy a home", text: "Browse houses and apartments for sale across Lagos, Abuja and every state.", cta: "Browse homes for sale", to: { to: "/listings" as const, search: { purpose: "sale" } } },
    { title: "List your property", text: "Posting is free. Set your own price, get approved and reach serious tenants and buyers.", cta: "Post a property", to: { to: "/post" as const, search: {} } },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Modern apartment building in Lagos" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/40" />
        <SiteHeader overlay />
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pb-20 pt-12 text-center md:pb-28 md:pt-20">
          <h1 className="text-4xl font-bold leading-tight drop-shadow md:text-6xl">Rentals. Homes.<br />Shops. Land.</h1>
          <form onSubmit={search} className="mt-8 flex w-full items-center rounded-xl bg-card px-5 py-1 text-card-foreground shadow-card">
            <input list="rr-areas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="State, area, street or keyword" aria-label="Search location" className="w-full bg-transparent py-3 text-base outline-none" />
            <datalist id="rr-areas">{AREA_OPTIONS.map((a) => <option key={a} value={a} />)}</datalist>
            <button type="submit" aria-label="Search"><Search className="h-6 w-6" /></button>
          </form>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-12">
        <h2 className="text-center text-2xl font-bold md:text-3xl">What are you looking for?</h2>
        <p className="mt-2 text-center text-muted-foreground">Every kind of space, in every state.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
          {CATEGORIES.map((c) => (
            <Link key={c.name} to="/listings" search={{ category: c.name }} className="overflow-hidden rounded-2xl border border-border bg-card shadow-card transition hover:-translate-y-1">
              <img src={c.img} alt={c.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="p-3"><div className="font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.sub}</div></div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-muted/50 px-5 py-12">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-3">
          {cards.map((c) => (
            <div key={c.title} className="flex flex-col items-center rounded-3xl border border-border bg-card p-8 text-center shadow-card">
              <h3 className="text-2xl font-bold">{c.title}</h3>
              <p className="mt-3 flex-1 text-muted-foreground">{c.text}</p>
              <Link {...c.to} className="mt-6 rounded-xl border-2 border-primary px-6 py-3 font-semibold text-primary hover:bg-primary hover:text-primary-foreground">{c.cta}</Link>
            </div>
          ))}
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
