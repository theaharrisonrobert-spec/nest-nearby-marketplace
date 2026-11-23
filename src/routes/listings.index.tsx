import { createFileRoute, Link as RouterLink, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ArrowRight, MapPin, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CATEGORIES, LISTING_COLS, STATES, type Listing, formatNaira, listingImage, PERIODS } from "@/lib/listings";

type S = { q?: string | undefined; location?: string | undefined; state?: string | undefined; city?: string | undefined; category?: string | undefined; purpose?: string | undefined; min?: number | undefined; max?: number | undefined; sort?: string | undefined };
const PURPOSES = [{ value: "sale", label: "For Sale" }, { value: "rent", label: "For Rent" }, { value: "short-let", label: "Short Let" }];

function normalizePurpose(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const v = value.trim().toLowerCase().replace(/[_\s]+/g, "-");
  if (v === "sale" || v === "for-sale") return "sale";
  if (v === "rent" || v === "for-rent") return "rent";
  if (v === "short-let" || v === "shortlet") return "short-let";
  return undefined;
}
function normalizeCategory(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return CATEGORIES.find((item) => item.name.toLowerCase() === value.trim().toLowerCase())?.name;
}

export const Route = createFileRoute("/listings/")({
  validateSearch: (search: Record<string, unknown>): S => ({
    q: typeof search["q"] === "string" ? search["q"] : undefined,
    location: typeof search["location"] === "string" ? search["location"] : undefined,
    state: typeof search["state"] === "string" ? search["state"] : undefined,
    city: typeof search["city"] === "string" ? search["city"] : undefined,
    category: normalizeCategory(search["category"]),
    purpose: normalizePurpose(search["purpose"]),
    min: typeof search["min"] === "number" && Number.isFinite(search["min"]) ? search["min"] : undefined,
    max: typeof search["max"] === "number" && Number.isFinite(search["max"]) ? search["max"] : undefined,
    sort: search["sort"] === "low" || search["sort"] === "high" ? search["sort"] : undefined,
  }),
  head: () => ({ meta: [
    { title: "Properties for Rent & Sale in Nigeria — RentReady" },
    { name: "description", content: "Browse apartments, houses, shops, offices, halls and land across Lagos, Abuja and all of Nigeria." },
    { property: "og:title", content: "Properties for Rent & Sale in Nigeria — RentReady" },
    { property: "og:description", content: "Find a place without an agent. Contact owners directly." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] }),
  component: ListingsPage,
});

function ListingsPage() {
  const s = Route.useSearch();
  const location = s.location ?? s.q ?? "";
  const { data = [], isLoading, isError } = useQuery({
    queryKey: ["listings", s],
    queryFn: async () => {
      await supabase.rpc("expire_listing_features");
      let query = supabase.from("listings").select(LISTING_COLS).eq("status", "approved").eq("availability_status", "available").eq("is_sample", false);
      if (s.state) query = query.eq("state", s.state);
      if (s.city) query = query.ilike("city", "%" + clean(s.city) + "%");
      if (s.category) query = query.eq("category", s.category);
      if (s.purpose === "short-let") query = query.in("purpose", ["short-let", "short_let", "shortlet"]); else if (s.purpose) query = query.eq("purpose", s.purpose);
      if (s.min !== undefined) query = query.gte("price", s.min);
      if (s.max !== undefined) query = query.lte("price", s.max);
      const locationWords = location.split(/[,\s]+/).map(clean).filter(Boolean);
      const normalizedLocation = " " + locationWords.join(" ").toLowerCase() + " ";
      const matchingState = [...STATES].sort((a, b) => b.length - a.length)
        .find((state) => normalizedLocation.includes(" " + state.toLowerCase() + " "));
      if (matchingState) query = query.eq("state", matchingState);
      const stateWords = matchingState?.toLowerCase().split(" ") ?? [];
      const area = locationWords.filter((word) => !stateWords.includes(word.toLowerCase())).join(" ");
      if (area) {
        query = query.or("title.ilike.%" + area + "%,city.ilike.%" + area + "%,state.ilike.%" + area + "%,landmarks.ilike.%" + area + "%");
      }
      query = query.order("featured_until", { ascending: false, nullsFirst: false });
      if (s.sort === "low") query = query.order("price", { ascending: true });
      else if (s.sort === "high") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      const { data, error } = await query.limit(100);
      if (error) throw error;
      const rows = data ?? [];
      const owners = [...new Set(rows.map((row) => row.owner_id).filter((owner): owner is string => !!owner))];
      const { data: blueTickOwners, error: badgeError } = owners.length ? await supabase.rpc("blue_tick_owner_ids", { _owners: owners }) : { data: [], error: null };
      if (badgeError) throw badgeError;
      const blueTickSet = new Set((blueTickOwners ?? []).map((row) => row.owner_id));
      const now = Date.now();
      return rows.map((row) => ({ ...row, owner_blue_tick: !!row.owner_id && blueTickSet.has(row.owner_id) })).sort((a, b) => {
        const aBoosted = !!a.boosted_until && new Date(a.boosted_until).getTime() > now;
        const bBoosted = !!b.boosted_until && new Date(b.boosted_until).getTime() > now;
        if (aBoosted !== bBoosted) return Number(bBoosted) - Number(aBoosted);
        if (a.owner_blue_tick !== b.owner_blue_tick) return Number(b.owner_blue_tick) - Number(a.owner_blue_tick);
        const aFeatured = !!a.featured_until && new Date(a.featured_until).getTime() > now;
        const bFeatured = !!b.featured_until && new Date(b.featured_until).getTime() > now;
        return Number(bFeatured) - Number(aFeatured);
      });
    },
  });
  const purposeLabel = PURPOSES.find((p) => p.value === s.purpose)?.label;
  const heading = [s.category ?? "Properties", purposeLabel, location ? "in " + location : s.state ? "in " + s.state : "in Nigeria"].filter(Boolean).join(" ");

  return <div className="min-h-screen bg-muted/40">
    <SiteHeader />
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-5 sm:py-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{heading}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Connect directly with verified landlords — no agent or agreement fee.</p>
      <ListingsFilters s={s} location={location} />
      <section aria-live="polite" className="mt-7">
        {isLoading ? <p className="text-muted-foreground">Loading properties…</p> : isError ? <p role="alert" className="text-muted-foreground">Could not load properties. Please try again.</p> : data.length === 0 ?
          <div className="rounded-xl bg-card p-8 text-center shadow-card sm:p-10"><p className="font-semibold">No properties found. Try changing your search.</p></div> :
          <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">{data.map((item) => <ResultCard key={item.id} item={item} />)}</div>}
      </section>
    </main>
    <SiteFooter />
  </div>;
}

function clean(value: string) {
  return value.replace(/[^\p{L}\p{N}\s-]/gu, "").replace(/\s+/g, " ").trim();
}
function ListingsFilters({ s, location }: { s: S; location: string }) {
  const navigate = useNavigate({ from: "/listings/" });
  const [query, setQuery] = useState(location);
  useEffect(() => setQuery(location), [location]);
  const set = (patch: Partial<S>) => navigate({ search: (previous) => ({ ...previous, ...patch }) });
  const field = "min-h-11 w-full rounded-lg border border-border bg-card px-3 py-2 text-sm outline-none focus:border-primary";
  return <form onSubmit={(event) => { event.preventDefault(); set({ location: query.trim() || undefined, q: undefined }); }} className="mt-5 grid gap-3 rounded-xl bg-card p-4 shadow-card sm:grid-cols-2 lg:grid-cols-6">
    <label className="flex min-h-11 items-center gap-2 rounded-lg border border-border px-3 sm:col-span-2 lg:col-span-2"><Search className="h-4 w-4 shrink-0 text-muted-foreground" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="City, state, or area" aria-label="Search city, state, or area" className="min-w-0 flex-1 bg-transparent py-2 text-sm outline-none" /></label>
    <select aria-label="State" className={field} value={s.state ?? ""} onChange={(event) => set({ state: event.target.value || undefined, city: undefined })}><option value="">All states</option>{STATES.map((state) => <option key={state} value={state}>{state}</option>)}</select>
    <select aria-label="Category" className={field} value={s.category ?? ""} onChange={(event) => set({ category: event.target.value || undefined })}><option value="">All types</option>{CATEGORIES.map((category) => <option key={category.name} value={category.name}>{category.name}</option>)}</select>
    <select aria-label="Purpose" className={field} value={s.purpose ?? ""} onChange={(event) => set({ purpose: event.target.value || undefined })}><option value="">For Sale / Rent / Short Let</option>{PURPOSES.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select>
    <select aria-label="Sort properties" className={field} value={s.sort ?? ""} onChange={(event) => set({ sort: event.target.value || undefined })}><option value="">Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option></select>
    <input aria-label="Minimum price" type="number" min="0" placeholder="Min price (₦)" className={field} value={s.min ?? ""} onChange={(event) => set({ min: event.target.value ? Number(event.target.value) : undefined })} />
    <input aria-label="Maximum price" type="number" min="0" placeholder="Max price (₦)" className={field} value={s.max ?? ""} onChange={(event) => set({ max: event.target.value ? Number(event.target.value) : undefined })} />
    <button type="submit" className="min-h-11 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Search</button>
    <button type="button" onClick={() => { setQuery(""); void navigate({ search: {} }); }} className="min-h-11 rounded-lg border border-border px-4 py-2 text-sm">Clear</button>
  </form>;
}
function ResultCard({ item }: { item: Listing & { owner_blue_tick?: boolean } }) {
  const label = item.purpose === "sale" ? "For Sale" : item.purpose === "short-let" || item.purpose === "short_let" ? "Short Let" : "For Rent";
  return <article className="overflow-hidden rounded-xl bg-card p-2 shadow-card">
    <img src={listingImage(item)} alt={item.title} loading="lazy" className="aspect-[16/10] w-full rounded-lg object-cover" />
    <div className="p-3">
      <span className="inline-flex rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">{label}</span>
      {item.boosted_until && new Date(item.boosted_until).getTime() > Date.now() && <span className="ml-2 inline-flex rounded-md bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">Boosted</span>}
      {item.owner_blue_tick && <span className="ml-2 inline-flex rounded-md bg-blue-100 px-2 py-1 text-xs font-semibold text-blue-800">Blue Tick</span>}
      <h2 className="mt-3 line-clamp-2 font-semibold">{item.title}</h2>
      <div className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4 shrink-0" />{item.state} · {item.city}</div>
      <p className="mt-2 text-lg font-bold text-primary">{formatNaira(item.price)} <span className="text-sm font-normal text-foreground">{PERIODS[item.price_period]}</span></p>
      <RouterLink to="/listings/$id" params={{ id: item.id }} className="mt-3 inline-flex items-center gap-2 text-sm font-semibold text-primary">View Property <ArrowRight className="h-4 w-4" /></RouterLink>
    </div>
  </article>;
}
