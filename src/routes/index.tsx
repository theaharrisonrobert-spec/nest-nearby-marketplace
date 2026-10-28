import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import {
  ArrowRight, Bath, BedDouble, Headphones, Heart, Lock, MapPin, Menu, Search, ShieldCheck, Square, Users, X, Home as HomeIcon,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import apartment from "@/assets/apartment.jpg";
import shop from "@/assets/shop.jpg";
import office from "@/assets/office.jpg";
import land from "@/assets/land.jpg";
import warehouse from "@/assets/warehouse.jpg";
import hall from "@/assets/hall.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RentReady — Discover. Connect. Secure Your Space." },
      { name: "description", content: "Buy, sell and rent apartments, shops, offices, event halls and land on one trusted, verified property marketplace." },
      { property: "og:title", content: "RentReady — Discover. Connect. Secure Your Space." },
      { property: "og:description", content: "A trusted marketplace for apartments, shops, offices, event halls and land — for rent or sale." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const nav = ["Home", "Properties", "Shops & Spaces", "How It Works", "About Us", "Contact"];

const categories = [
  { name: "Apartments", sub: "For Rent & Sale", img: apartment },
  { name: "Shops", sub: "For Rent & Sale", img: shop },
  { name: "Office Spaces", sub: "For Rent & Sale", img: office },
  { name: "Event Halls", sub: "For Rent", img: hall },
  { name: "Land", sub: "For Sale & Lease", img: land },
  { name: "Other Spaces", sub: "Warehouses & more", img: warehouse },
];

const listings = [
  { tag: "For Rent", title: "3 Bedroom Apartment", loc: "Lekki, Lagos", price: "₦2,000,000", per: "/ year", img: apartment, a: "3 Beds", b: "3 Baths", c: "1,500 sqft" },
  { tag: "For Sale", title: "Shop Space", loc: "Ikeja, Lagos", price: "₦35,000,000", per: "", img: shop, a: "1 Room", b: "1 Bath", c: "600 sqft" },
  { tag: "For Rent", title: "Office Space", loc: "Victoria Island, Lagos", price: "₦1,500,000", per: "/ year", img: office, a: "1 Room", b: "1 Bath", c: "1,000 sqft" },
];

const perks = [
  { icon: ShieldCheck, l: "Verified Users & Listings" },
  { icon: Lock, l: "Secure Transactions" },
  { icon: Headphones, l: "24/7 Support" },
  { icon: Users, l: "Wide Range of Options" },
];

function Logo({ light = false }: { light?: boolean }) {
  return (
    <a href="/" className="flex items-center gap-2">
      <HomeIcon className="h-8 w-8 text-brand" strokeWidth={2.5} />
      <div className="leading-none">
        <div className={`font-display text-2xl font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>
          Rent<span className="text-brand">Ready</span>
        </div>
        <div className={`text-[11px] ${light ? "text-ink-foreground/70" : "text-muted-foreground"}`}>Find. Rent. Buy. Grow.</div>
      </div>
    </a>
  );
}

function Index() {
  const [open, setOpen] = useState(false);
  const [fav, setFav] = useState<Record<number, boolean>>({});

  return (
    <div className="min-h-screen bg-background">
      {/* Header + hero */}
      <section className="relative overflow-hidden bg-ink text-ink-foreground">
        <img src={hero} alt="Modern apartment building at dusk" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-hero-overlay" />
        <header className="relative z-10 border-b border-ink-foreground/10 bg-ink/60 backdrop-blur">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
            <Logo light />
            <nav className="hidden gap-7 text-sm lg:flex">
              {nav.map((n) => <a key={n} href="#" className="text-ink-foreground/85 hover:text-brand">{n}</a>)}
            </nav>
            <div className="hidden gap-3 lg:flex">
              <button className="rounded-lg border border-ink-foreground/60 px-5 py-2 text-sm font-medium hover:bg-ink-foreground/10">Sign In</button>
              <button className="rounded-lg bg-brand px-5 py-2 text-sm font-medium text-brand-foreground hover:opacity-90">Sign Up</button>
            </div>
            <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">
              {open ? <X /> : <Menu />}
            </button>
          </div>
          {open && (
            <div className="space-y-3 px-5 pb-5 lg:hidden">
              {nav.map((n) => <a key={n} href="#" className="block text-ink-foreground/90">{n}</a>)}
              <div className="flex gap-3 pt-2">
                <button className="flex-1 rounded-lg border border-ink-foreground/60 py-2 text-sm">Sign In</button>
                <button className="flex-1 rounded-lg bg-brand py-2 text-sm text-brand-foreground">Sign Up</button>
              </div>
            </div>
          )}
        </header>

        <div className="relative z-10 mx-auto max-w-7xl px-5 pb-12 pt-12 lg:pb-16 lg:pt-20">
          <h1 className="max-w-2xl text-4xl font-bold leading-tight md:text-6xl">
            Your Trusted Platform for <span className="text-brand">Every Kind of Space</span>
          </h1>
          <p className="mt-5 max-w-lg text-base text-ink-foreground/85 md:text-lg">
            Discover apartments, houses, shops, offices, event halls and land — for rent or sale, all in one place.
          </p>
          <p className="pointer-events-none absolute right-8 top-24 hidden -rotate-6 font-script text-5xl text-ink-foreground/90 xl:block">
            Your Space. Your Choice.
          </p>
          <div className="mt-8 grid max-w-2xl grid-cols-2 gap-4 md:grid-cols-4">
            {perks.map(({ icon: I, l }) => (
              <div key={l} className="flex items-center gap-3 text-sm">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand/25 text-brand"><I className="h-5 w-5" /></span>
                {l}
              </div>
            ))}
          </div>

          <form onSubmit={(e) => e.preventDefault()} className="mt-10 grid max-w-4xl gap-3 rounded-2xl bg-card p-3 text-card-foreground shadow-card md:grid-cols-[1.2fr_1fr_1fr_auto]">
            <label className="flex items-center gap-3 rounded-xl border border-border px-4 py-2">
              <MapPin className="h-5 w-5 text-brand" />
              <span className="flex-1">
                <span className="block text-xs font-medium">Location</span>
                <input placeholder="e.g. Lagos, Abuja" className="w-full bg-transparent text-sm outline-none" />
              </span>
            </label>
            <label className="rounded-xl border border-border px-4 py-2">
              <span className="block text-xs font-medium">Property Type</span>
              <select className="w-full bg-transparent text-sm outline-none">
                <option>All Types</option>{categories.map((c) => <option key={c.name}>{c.name}</option>)}
              </select>
            </label>
            <label className="rounded-xl border border-border px-4 py-2">
              <span className="block text-xs font-medium">Price Range</span>
              <select className="w-full bg-transparent text-sm outline-none">
                <option>Any Price</option><option>Under ₦1M</option><option>₦1M – ₦10M</option><option>Above ₦10M</option>
              </select>
            </label>
            <button className="flex items-center justify-center gap-2 rounded-xl bg-primary px-8 py-3 font-medium text-primary-foreground hover:opacity-90">
              <Search className="h-4 w-4" /> Search
            </button>
          </form>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-5 py-14">
        <h2 className="text-3xl font-bold">Browse by Category</h2>
        <p className="mt-2 text-muted-foreground">Explore a wide range of rental and sale options, tailored to your needs.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
          {categories.map((c) => (
            <a key={c.name} href="#" className="group overflow-hidden rounded-xl border border-border bg-card shadow-card transition hover:-translate-y-1">
              <img src={c.img} alt={c.name} loading="lazy" width={944} height={704} className="aspect-[4/3] w-full object-cover" />
              <div className="flex items-end justify-between p-4">
                <div>
                  <div className="font-display font-semibold">{c.name}</div>
                  <div className="text-xs text-muted-foreground">{c.sub}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground transition group-hover:text-brand" />
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Featured */}
      <section className="bg-muted/60 py-14">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex items-end justify-between">
            <div>
              <h2 className="text-3xl font-bold">Featured Listings</h2>
              <p className="mt-2 text-muted-foreground">Discover some of our top properties and spaces.</p>
            </div>
            <a href="#" className="text-sm font-medium text-primary">View All</a>
          </div>
          <div className="mt-8 grid gap-6 md:grid-cols-3">
            {listings.map((l, i) => (
              <article key={l.title} className="overflow-hidden rounded-xl bg-card p-2 shadow-card">
                <div className="relative">
                  <img src={l.img} alt={l.title} loading="lazy" width={944} height={704} className="aspect-[16/10] w-full rounded-lg object-cover" />
                  <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">{l.tag}</span>
                  <button onClick={() => setFav({ ...fav, [i]: !fav[i] })} aria-label="Save" className="absolute right-2 top-2 text-ink-foreground">
                    <Heart className={`h-6 w-6 ${fav[i] ? "fill-destructive text-destructive" : ""}`} />
                  </button>
                </div>
                <div className="p-3">
                  <h3 className="font-semibold">{l.title}</h3>
                  <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{l.loc}</div>
                  <div className="mt-2 text-lg font-bold text-primary">{l.price} <span className="text-sm font-normal text-foreground">{l.per}</span></div>
                  <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{l.a}</span>
                    <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{l.b}</span>
                    <span className="flex items-center gap-1"><Square className="h-4 w-4" />{l.c}</span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          <div className="mt-10 flex flex-col items-start gap-4 rounded-xl bg-brand-soft p-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <ShieldCheck className="h-10 w-10 shrink-0 text-primary" />
              <div>
                <div className="font-semibold text-primary">Get Verified. Build Trust.</div>
                <div className="text-sm text-muted-foreground">Identity verification for every user keeps the marketplace safe and reliable.</div>
              </div>
            </div>
            <button className="rounded-lg bg-primary px-6 py-3 text-sm font-medium text-primary-foreground">Sign Up Now</button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-ink text-ink-foreground">
        <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4">
          <div>
            <Logo light />
            <p className="mt-4 text-sm text-ink-foreground/70">Your Space. Your Choice. Your Next Move.</p>
          </div>
          {[
            ["Quick Links", ["Home", "Properties", "Shops & Spaces", "How It Works"]],
            ["Support", ["Help Center", "Contact Us", "Terms & Conditions", "Privacy Policy"]],
            ["List with us", ["List a Property", "Get Verified", "Owner Guide"]],
          ].map(([h, items]) => (
            <div key={h as string}>
              <div className="mb-3 font-semibold">{h as string}</div>
              <ul className="space-y-2 text-sm text-ink-foreground/70">
                {(items as string[]).map((x) => <li key={x}><a href="#" className="hover:text-brand">{x}</a></li>)}
              </ul>
            </div>
          ))}
        </div>
        <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/60">© 2026 RentReady. All rights reserved.</div>
      </footer>
    </div>
  );
}
