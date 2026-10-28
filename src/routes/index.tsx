import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowRight, BadgePercent, Headphones, MapPin, Search, ShieldCheck, Tag, UserX } from "lucide-react";
import hero from "@/assets/hero.jpg";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, POPULAR_AREAS, PRICE_RANGES, STATES } from "@/lib/listings";

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

const perks = [
  { icon: UserX, l: "No Agent Needed" },
  { icon: Tag, l: "Owners Set Their Price" },
  { icon: ShieldCheck, l: "Verified Accounts" },
  { icon: Headphones, l: "Direct WhatsApp Contact" },
];

function Index() {
  const navigate = useNavigate();
  const [loc, setLoc] = useState("");
  const [state, setState] = useState("");
  const [cat, setCat] = useState("");
  const [range, setRange] = useState(0);

  const { data: featured } = useQuery({
    queryKey: ["featured"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data;
    },
  });

  function search(e: React.FormEvent) {
    e.preventDefault();
    const r = PRICE_RANGES[range] ?? PRICE_RANGES[0];
    navigate({ to: "/listings", search: { q: loc || undefined, state: state || undefined, category: cat || undefined, min: r.min, max: r.max } });
  }

  const field = "w-full bg-transparent text-sm outline-none";
  return (
    <div className="min-h-screen bg-background">
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Modern apartment building in Lagos at dusk" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <SiteHeader overlay />
        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
            Find your next space in <span className="text-brand">Lagos & across Nigeria</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-ink-foreground/85 md:text-lg">
            Apartments, houses, shops, offices, event halls and land — talk straight to the owner. No agent, no agency fee.
          </p>
          <p className="pointer-events-none absolute right-8 top-24 hidden -rotate-6 font-script text-5xl text-ink-foreground/90 xl:block">Your Space. Your Choice.</p>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
            {perks.map(({ icon: I, l }) => (
              <div key={l} className="flex items-center gap-3 text-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/25 text-brand"><I className="h-5 w-5" /></span>{l}
              </div>
            ))}
          </div>

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

      <section className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-3xl font-bold">Popular places in Nigeria</h2>
        <p className="mt-2 text-muted-foreground">Jump straight into the areas people search most.</p>
        <div className="mt-6 flex flex-wrap gap-3">
          {POPULAR_AREAS.map((a) => (
            <Link key={a.state + a.city} to="/listings" search={{ state: a.state, city: a.city || undefined }}
              className="flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm shadow-card hover:border-primary hover:text-primary">
              <MapPin className="h-4 w-4 text-brand" /> {a.city ? `${a.city}, ${a.state}` : a.state}
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-14">
        <h2 className="text-3xl font-bold">Browse by Category</h2>
        <p className="mt-2 text-muted-foreground">Explore a wide range of rental and sale options, tailored to your needs.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4 lg:grid-cols-7">
          {CATEGORIES.map((c) => (
            <Link key={c.name} to="/listings" search={{ category: c.name }} className="group overflow-hidden rounded-xl border border-border bg-card shadow-card transition hover:-translate-y-1">
              <img src={c.img} alt={c.name} loading="lazy" className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-end justify-between p-4">
                <div><div className="font-display font-semibold">{c.name}</div><div className="text-xs text-muted-foreground">{c.sub}</div></div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-brand" />
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-muted/60 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex items-end justify-between">
            <div><h2 className="text-3xl font-bold">Latest Listings</h2><p className="mt-2 text-muted-foreground">Fresh properties posted directly by owners.</p></div>
            <Link to="/listings" className="text-sm font-medium text-primary">View All</Link>
          </div>
          <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {featured?.map((l) => <ListingCard key={l.id} l={l} />)}
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-2">
            <div className="flex flex-col gap-4 rounded-xl bg-brand-soft p-6">
              <BadgePercent className="h-10 w-10 text-primary" />
              <div><div className="text-lg font-semibold text-primary">Have a property? Post it at your price.</div>
                <div className="text-sm text-muted-foreground">Free to list. Renters and buyers reach you directly on WhatsApp or by phone.</div></div>
              <Link to="/post" className="w-fit rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Post a Property</Link>
            </div>
            <div className="flex flex-col gap-4 rounded-xl bg-ink p-6 text-ink-foreground">
              <ShieldCheck className="h-10 w-10 text-brand" />
              <div><div className="text-lg font-semibold">Get Verified. Build Trust.</div>
                <div className="text-sm text-ink-foreground/70">Create your account to post, save and manage your listings.</div></div>
              <Link to="/auth" search={{ mode: "signup" }} className="w-fit rounded-lg bg-brand px-6 py-3 text-sm font-medium text-brand-foreground">Sign Up Now</Link>
            </div>
          </div>
        </div>
      </section>
      <SiteFooter />
    </div>
  );
}
