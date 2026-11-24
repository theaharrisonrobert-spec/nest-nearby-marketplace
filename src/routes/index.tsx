import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useSession } from "@/hooks/use-session";
import { ArrowRight, Building2, MapPin, MessageCircle, Search, ShieldCheck, type LucideIcon } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import { CATEGORIES, formatNaira, LISTING_COLS, listingImage, PERIODS, type Listing } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";
import heroApartment from "@/assets/apartment.jpg";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({ meta: [
    { title: "RentReady — Rent, Buy & List Property Across Nigeria" },
    { name: "description", content: "Find homes, shops, offices and land for rent or sale across Nigeria." },
    { property: "og:title", content: "RentReady — Rentals. Homes. Shops. Land." },
    { property: "og:description", content: "Search every state and area in Nigeria. Talk to owners directly." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
});

function Index() {
  const { user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["home-greeting-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, account_type, professional_type").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ["home-greeting-admin", user?.id],
    enabled: !!user,
    queryFn: async () => user ? (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data ?? false : false,
  });
  const canPostProperty = isAdmin || profile?.account_type === "landlord";
  const firstName = profile?.full_name?.trim().split(/\s+/)[0];
  const greeting = user ? (firstName ? `Hi, ${firstName}` : "Hi there") : "Find your perfect rental in Lagos";
  const { data: featured = [], isLoading } = useQuery({
    queryKey: ["home-featured-approved-listings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS)
        .eq("status", "approved").eq("availability_status", "available").eq("is_sample", false).not("image_url", "is", null)
        .order("sponsored", { ascending: false }).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
  return <div className="min-h-screen bg-[#F5F1E8] text-foreground">
    <SiteHeader home />
    <section className="home-hero-background relative flex min-h-[580px] items-center overflow-hidden sm:min-h-[640px]" style={{ "--home-hero-photo": `url(${heroApartment})` } as React.CSSProperties}>
      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col items-center px-5 py-16 text-center md:py-24">
        <h1 className="max-w-5xl text-4xl font-extrabold leading-tight tracking-tight text- white sm:text-5xl md:text-6xl lg:text-7xl">{greeting}</h1>
        <p className="mt-5 max-w-3xl text-base leading-relaxed text-muted-foreground sm:text-lg md:text-xl">Discover homes, shops and spaces to rent or buy across Nigeria.</p>
        <HeroSearch />
      </div>
    </section>
    <section className="mx-auto max-w-7xl px-5 py-16 md:py-20">
      <Heading eyebrow="Explore RentReady" title="Find your next space" text="Browse property types and find a place that fits your next move." />
      <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{CATEGORIES.map((c) => <Link key={c.name} to="/listings" search={{ category: c.name }} className="group overflow-hidden rounded-2xl border border-border bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
        <img src={c.img} alt="" loading="lazy" className="h-40 w-full object-cover" /><div className="flex items-center justify-between p-4"><div><h3 className="font-semibold">{c.name}</h3><p className="mt-1 text-sm text-muted-foreground">{c.sub}</p></div><ArrowRight className="h-5 w-5 text-primary" /></div>
      </Link>)}</div>
    </section>
    <section className="bg-muted px-5 py-16 md:py-20"><div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4"><Heading eyebrow="Current RentReady listings" title="Featured properties" text="Browse approved properties currently listed on RentReady." /><Link to="/listings" className="mb-1 inline-flex items-center gap-2 font-semibold text-primary">View all properties <ArrowRight className="h-4 w-4" /></Link></div>
      {isLoading ? <p className="mt-8 text-muted-foreground">Loading approved properties…</p> : featured.length ? <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{featured.map((listing) => <HomeListingCard key={listing.id} listing={listing} />)}</div> :
      <div className="mt-8 rounded-2xl border border-border bg-white px-6 py-12 text-center"><Building2 className="mx-auto h-9 w-9 text-primary" /><h3 className="mt-4 text-lg font-semibold">No approved properties to feature yet</h3><p className="mt-2 text-sm text-muted-foreground">Browse all properties or check back later.</p><Button asChild className="mt-5 bg-primary text-white hover:bg-primary/90"><Link to="/listings">Browse properties</Link></Button></div>}
    </div></section>
    <section className="px-5 py-16 md:py-20"><div className="mx-auto grid max-w-7xl items-center gap-10 rounded-3xl bg-primary px-7 py-10 text-white sm:px-12 md:grid-cols-[1fr_auto] md:py-14">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-white/75">For property owners</p><h2 className="mt-3 text-3xl font-bold sm:text-4xl">List your property</h2><p className="mt-4 max-w-2xl text-white/85">Add your property to RentReady and connect directly with people looking for a place in Nigeria.</p></div>
      {canPostProperty ? <Button asChild className="h-12 bg-white px-6 font-semibold text-primary hover:bg-white/90"><Link to="/post">+ Post Property <ArrowRight /></Link></Button> : user ? <Button asChild className="h-12 bg-white px-6 font-semibold text-primary hover:bg-white/90"><Link to="/settings" hash="account-type">Become a Landlord to Post <ArrowRight /></Link></Button> : <Button asChild className="h-12 bg-white px-6 font-semibold text-primary hover:bg-white/90"><Link to="/auth" search={{ mode: "signup", type: "landlord" }}>Become a Landlord to Post <ArrowRight /></Link></Button>}
    </div></section>
    <section className="bg-muted px-5 py-16 md:py-20"><div className="mx-auto max-w-7xl"><Heading eyebrow="A simpler way to find your next place" title="Why choose RentReady" text="Straightforward property search, with the tools you need to make your next move." />
      <div className="mt-9 grid gap-5 md:grid-cols-3"><Reason icon={Search} title="Search across Nigeria" text="Explore properties by location, purpose and property type." /><Reason icon={MessageCircle} title="Connect directly" text="Contact property owners through RentReady to ask questions and arrange a viewing." /><Reason icon={ShieldCheck} title="Reviewed listings" text="Approved listings are reviewed before they appear as live properties." /></div>
    </div></section>
    <section className="px-5 py-16 md:py-20"><div className="mx-auto max-w-7xl"><Heading eyebrow="A clear path to your next move" title="How it works" text="Find a property and arrange your next step through RentReady." />
      <div className="mt-9 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">{[
        { icon: Search, title: "Search", text: "Choose an area, property type, and whether you want to buy, rent, or book a short let." },
        { icon: Building2, title: "Explore", text: "Compare photos, prices, and locations in approved listings." },
        { icon: MessageCircle, title: "Contact", text: "Ask the property owner questions through RentReady." },
        { icon: MapPin, title: "Arrange viewing", text: "Request a time to see the property in person." },
      ].map((step, index) => <HowStep key={step.title} icon={step.icon} title={step.title} text={step.text} index={index + 1} />)}</div>
    </div></section>
    <SiteFooter />
  </div>;
}
function Heading({ eyebrow, title, text }: { eyebrow: string; title: string; text: string }) {
  return <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">{eyebrow}</p><h2 className="mt-2 text-3xl font-bold sm:text-4xl">{title}</h2><p className="mt-3 max-w-2xl text-muted-foreground">{text}</p></div>;
}
function Reason({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return <article className="rounded-2xl border border-border bg-white p-6"><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-6 w-6" /></span><h3 className="mt-5 text-lg font-semibold">{title}</h3><p className="mt-2 leading-relaxed text-muted-foreground">{text}</p></article>;
}
function HowStep({ icon: Icon, title, text, index }: { icon: LucideIcon; title: string; text: string; index: number }) {
  return <article className="rounded-2xl border border-border bg-white p-6"><span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">{index}</span><Icon className="mt-5 h-6 w-6 text-primary" /><h3 className="mt-3 text-lg font-semibold">{title}</h3><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p></article>;
}
function HeroSearch() {
  const navigate = useNavigate();
  const [purpose, setPurpose] = useState("sale");
  const [location, setLocation] = useState("");
  function search(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void navigate({ to: "/listings", search: { purpose, q: location.trim() || undefined } });
  }
  return <form onSubmit={search} className="mt-9 w-full max-w-4xl rounded-2xl bg-white p-3 text-left shadow-xl ring-1 ring-border sm:mt-10 sm:p-4">
    <div className="flex gap-1 border-b border-border pb-3" role="tablist" aria-label="Property purpose">{([['sale', 'Buy'], ['rent', 'Rent'], ['short-let', 'Short Let']] as const).map(([value, label]) => <button key={value} type="button" role="tab" aria-selected={purpose === value} onClick={() => setPurpose(value)} className={`rounded-lg px-4 py-2.5 text-sm font-semibold ${purpose === value ? "bg-primary text-white" : "text-muted-foreground hover:bg-muted/70"}`}>{label}</button>)}</div>
    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
      <label className="flex h-12 items-center gap-3 rounded-xl border border-border px-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/20"><MapPin className="h-5 w-5 shrink-0 text-primary" /><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Enter city, area, or state..." aria-label="Enter city, area, or state" autoComplete="off" className="min-w-0 flex-1 bg-transparent text-base text-foreground outline-none placeholder:text-muted-foreground" /></label>
      <Button type="submit" className="h-12 rounded-xl bg-primary px-8 text-white hover:bg-primary/90"><Search className="h-4 w-4" />Search</Button>
    </div>
  </form>;
}

function HomeListingCard({ listing }: { listing: Listing }) {
  const purposeLabel = listing.purpose === "sale" ? "For Sale" : listing.purpose === "short-let" || listing.purpose === "short_let" ? "Short Let" : "For Rent";
  return <article className="overflow-hidden rounded-xl border border-border bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg">
    <Link to="/listings/$id" params={{ id: listing.id }} className="block">
      <div><img src={listingImage(listing)} alt={listing.title} loading="lazy" className="aspect-[16/10] w-full object-cover" /></div>
      <div className="p-4"><span className="inline-block rounded-md bg-brand-soft px-3 py-1 text-xs font-semibold text-primary">{purposeLabel}</span><p className="mt-3 text-xl font-bold text-primary">{formatNaira(listing.price)} <span className="text-sm font-normal text-muted-foreground">{PERIODS[listing.price_period]}</span></p><h3 className="mt-2 line-clamp-2 font-semibold text-foreground">{listing.title}</h3><p className="mt-2 text-sm text-muted-foreground">{listing.state} · {listing.city}</p><span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">View Property <ArrowRight className="h-4 w-4" /></span></div>
    </Link>
  </article>;
}
