import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import {
  Building2, ChevronDown, Heart, Home as HomeIcon, KeyRound, LandPlot, Menu, MessageSquare,
  PartyPopper, Plus, Search, Store, Briefcase, Warehouse, ShoppingBag, User, X, type LucideIcon,
} from "lucide-react";
import hero from "@/assets/hero.jpg";
import { STATES, POPULAR_AREAS } from "@/lib/listings";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "RentReady — Rent, Buy & List Property Across Nigeria" },
      { name: "description", content: "Find apartments, houses, shops, malls, office spaces, event halls, land and other spaces for rent or sale in every Nigerian state." },
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

type Card = { icon: LucideIcon; title: string; text: string; cta: string; to: "/listings" | "/post"; search: Record<string, string> };
const CARDS: Card[] = [
  { icon: KeyRound, title: "Rent a home", text: "Apartments, flats and houses for rent — message the owner directly, no agent needed.", cta: "Find rentals", to: "/listings", search: { purpose: "rent" } },
  { icon: HomeIcon, title: "Buy a home", text: "Browse houses and apartments for sale in Lagos, Abuja and every state.", cta: "Browse homes", to: "/listings", search: { purpose: "sale" } },
  { icon: Store, title: "Shops", text: "Shops and stores for rent or sale in busy markets and streets.", cta: "Find shops", to: "/listings", search: { category: "Shops" } },
  { icon: ShoppingBag, title: "Malls", text: "Mall units and plaza spaces for your business.", cta: "Find mall spaces", to: "/listings", search: { category: "Malls" } },
  { icon: Briefcase, title: "Office spaces", text: "Offices and co-working spaces for teams of any size.", cta: "Find offices", to: "/listings", search: { category: "Office Spaces" } },
  { icon: PartyPopper, title: "Event halls", text: "Halls and venues for weddings, parties and meetings.", cta: "Find event halls", to: "/listings", search: { category: "Event Halls" } },
  { icon: LandPlot, title: "Land", text: "Plots and land for sale or lease across Nigeria.", cta: "Find land", to: "/listings", search: { category: "Land" } },
  { icon: Warehouse, title: "Other spaces", text: "Warehouses, garages, storage and more.", cta: "See other spaces", to: "/listings", search: { category: "Other Spaces" } },
  { icon: Building2, title: "List your property", text: "Posting is free. Set your own price and reach serious tenants and buyers.", cta: "Post a property", to: "/post", search: {} },
];

function Index() {
  const navigate = useNavigate();
  const { user } = useSession();
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState(false);

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

  return (
    <div className="flex min-h-screen flex-col bg-background pb-16 lg:pb-0">
      <section className="relative bg-ink text-ink-foreground">
        <img src={hero} alt="Apartment building in Nigeria" width={1600} height={912} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-ink/35" />
        <header className="relative z-20 flex items-center justify-between px-5 py-4">
          <button onClick={() => setMenu(!menu)} aria-label="Menu">{menu ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}</button>
          <Link to="/" className="flex items-center gap-1.5 font-display text-3xl font-bold drop-shadow">
            <HomeIcon className="h-7 w-7" strokeWidth={2.75} /> RentReady
          </Link>
          {user ? (
            <Link to="/dashboard" aria-label="My account" className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground"><User className="h-5 w-5" /></Link>
          ) : (
            <Link to="/auth" search={{ mode: "signin" }} className="text-sm font-semibold drop-shadow">Sign in</Link>
          )}
        </header>
        {menu && (
          <nav className="relative z-20 mx-5 space-y-1 rounded-xl bg-card p-3 text-card-foreground shadow-card">
            {[
              { to: "/listings", label: "All properties", search: {} },
              { to: "/listings", label: "For rent", search: { purpose: "rent" } },
              { to: "/listings", label: "For sale", search: { purpose: "sale" } },
              { to: "/post", label: "Post a property", search: {} },
              { to: "/how-it-works", label: "How it works", search: {} },
              { to: "/help", label: "Help", search: {} },
            ].map((l) => (
              <Link key={l.label} to={l.to} search={l.search as never} className="block rounded-lg px-3 py-2 hover:bg-muted">{l.label}</Link>
            ))}
            {!user && <Link to="/auth" search={{ mode: "signup" }} className="block rounded-lg px-3 py-2 font-semibold text-primary hover:bg-muted">Create account</Link>}
          </nav>
        )}
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pb-24 pt-10 text-center md:pb-32 md:pt-16">
          <h1 className="text-5xl font-bold leading-[1.05] drop-shadow md:text-7xl">Rentals. Homes.<br />Shops. Land.</h1>
          <form onSubmit={search} className="mt-8 flex w-full items-center rounded-xl border border-border bg-card px-5 py-1.5 text-card-foreground shadow-card">
            <input list="rr-areas" value={q} onChange={(e) => setQ(e.target.value)} placeholder="State, area, street or keyword" aria-label="Search location" className="w-full bg-transparent py-3 text-base outline-none" />
            <datalist id="rr-areas">{AREA_OPTIONS.map((a) => <option key={a} value={a} />)}</datalist>
            <button type="submit" aria-label="Search"><Search className="h-6 w-6" strokeWidth={2.5} /></button>
          </form>
        </div>
      </section>

      <section className="px-5 py-12 text-center">
        <h2 className="text-3xl font-bold">Find your next space</h2>
        <p className="mx-auto mt-3 max-w-xl text-lg text-muted-foreground">Search any state or area in Nigeria and talk to owners directly through private messages.</p>
      </section>

      <section className="bg-muted/60 px-5 py-10">
        <div className="mx-auto grid max-w-6xl gap-6 md:grid-cols-2 lg:grid-cols-3">
          {CARDS.map((c) => (
            <div key={c.title} className="flex flex-col items-center rounded-3xl border border-border bg-card px-6 py-12 text-center shadow-card">
              <div className="flex h-28 w-28 items-center justify-center rounded-[45%_55%_50%_50%] bg-brand-soft">
                <c.icon className="h-14 w-14 text-primary" strokeWidth={1.75} />
              </div>
              <h3 className="mt-6 text-3xl font-bold">{c.title}</h3>
              <p className="mt-3 flex-1 text-lg text-foreground/80">{c.text}</p>
              <Link to={c.to} search={c.search as never} className="mt-6 rounded-xl border-2 border-primary px-7 py-3 text-lg font-bold text-primary hover:bg-primary hover:text-primary-foreground">{c.cta}</Link>
            </div>
          ))}
        </div>
      </section>

      <footer className="px-5 pt-10 text-foreground">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-2 gap-x-6">
            <FooterGroup title="Rentals" links={[["For rent", { purpose: "rent" }], ["Apartments", { category: "Apartments" }], ["Shops", { category: "Shops" }], ["Event halls", { category: "Event Halls" }]]} />
            <FooterGroup title="For sale" links={[["For sale", { purpose: "sale" }], ["Houses", { category: "Houses" }], ["Land", { category: "Land" }], ["Malls", { category: "Malls" }]]} />
            <FooterGroup title="Popular states" links={["Lagos", "Abuja", "Rivers", "Oyo", "Ogun"].map((s) => [s, { state: s }] as [string, Record<string, string>])} />
            <FooterGroup title="Spaces" links={[["Office spaces", { category: "Office Spaces" }], ["Other spaces", { category: "Other Spaces" }], ["All properties", {}]]} />
          </div>
          <div className="mt-6 grid grid-cols-2 gap-y-5 border-t border-border py-8 text-lg">
            <Link to="/how-it-works">How it works</Link>
            <Link to="/terms">Terms of use</Link>
            <Link to="/landlords">For landlords & agents</Link>
            <Link to="/privacy">Privacy notice</Link>
            <Link to="/help">Help</Link>
            <Link to="/contact">Contact us</Link>
          </div>
          <p className="border-t border-border py-6 text-center text-sm text-muted-foreground">© 2026 RentReady. Connecting Properties, People, and Opportunities.</p>
        </div>
      </footer>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-card py-2 text-xs text-muted-foreground lg:hidden">
        <BottomItem to="/listings" icon={Search} label="Search" />
        <BottomItem to="/listings" icon={Heart} label="Saved" />
        <BottomItem to="/post" icon={Plus} label="Post" />
        <BottomItem to="/messages" icon={MessageSquare} label="Inbox" />
        <BottomItem to="/dashboard" icon={User} label="Account" />
      </nav>
    </div>
  );
}

function FooterGroup({ title, links }: { title: string; links: [string, Record<string, string>][] }) {
  return (
    <details className="group py-3">
      <summary className="flex cursor-pointer list-none items-center justify-between text-lg">
        {title} <ChevronDown className="h-5 w-5 text-primary transition group-open:rotate-180" />
      </summary>
      <ul className="mt-2 space-y-2 text-muted-foreground">
        {links.map(([label, s]) => (
          <li key={label}><Link to="/listings" search={s as never}>{label}</Link></li>
        ))}
      </ul>
    </details>
  );
}

function BottomItem({ to, icon: Icon, label }: { to: "/listings" | "/post" | "/messages" | "/dashboard"; icon: LucideIcon; label: string }) {
  return (
    <Link to={to} className="flex flex-col items-center gap-1">
      <Icon className="h-6 w-6 text-foreground/70" />
      {label}
    </Link>
  );
}
