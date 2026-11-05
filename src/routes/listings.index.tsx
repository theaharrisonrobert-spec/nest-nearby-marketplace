import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ListingCard } from "@/components/ListingCard";
import { CATEGORIES, STATES } from "@/lib/listings";
import { LISTING_COLS } from "@/lib/listings";
import { categoryMatches } from "@/lib/marketplace-rules";

type S = { q?: string | undefined; state?: string | undefined; city?: string | undefined; category?: string | undefined; purpose?: string | undefined; min?: number | undefined; max?: number | undefined; sort?: string | undefined };

export const Route = createFileRoute("/listings/")({
  validateSearch: (s: Record<string, unknown>): S => ({
    q: s["q"] ? String(s["q"]) : undefined,
    state: s["state"] ? String(s["state"]) : undefined,
    city: s["city"] ? String(s["city"]) : undefined,
    category: s["category"] ? String(s["category"]) : undefined,
    purpose: s["purpose"] ? String(s["purpose"]) : undefined,
    min: s["min"] ? Number(s["min"]) : undefined,
    max: s["max"] ? Number(s["max"]) : undefined,
    sort: s["sort"] ? String(s["sort"]) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Properties for Rent & Sale in Nigeria — RentReady" },
      { name: "description", content: "Browse apartments, houses, shops, offices, halls and land across Lagos, Abuja and all of Nigeria. Contact owners directly, no agent needed." },
      { property: "og:title", content: "Properties for Rent & Sale in Nigeria — RentReady" },
      { property: "og:description", content: "Find a place without an agent. Contact owners directly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ListingsPage,
});

function ListingsPage() {
  const s = Route.useSearch();
  const navigate = useNavigate({ from: "/listings/" });
  const [q, setQ] = useState(s.q ?? "");
  const set = (patch: Partial<S>) => navigate({ search: (prev) => ({ ...prev, ...patch }) });

  const { data, isLoading } = useQuery({
    queryKey: ["listings", s],
    queryFn: async () => {
      let query = supabase.from("listings").select(LISTING_COLS).eq("status", "approved").order("sponsored", { ascending: false });
      if (s.state) query = query.eq("state", s.state);
      if (s.city) query = query.ilike("city", `%${s.city}%`);
      if (s.category) query = query.eq("category", s.category);
      if (s.purpose) query = query.eq("purpose", s.purpose);
      if (s.min) query = query.gte("price", s.min);
      if (s.max) query = query.lte("price", s.max);
      if (s.q) query = query.or(`title.ilike.%${s.q}%,city.ilike.%${s.q}%,landmarks.ilike.%${s.q}%,state.ilike.%${s.q}%`);
      if (s.sort === "low") query = query.order("price", { ascending: true });
      else if (s.sort === "high") query = query.order("price", { ascending: false });
      else query = query.order("created_at", { ascending: false });
      const { data, error } = await query.limit(100);
      if (error) throw error;
      return data?.filter(l => categoryMatches(l.category, s.category));
    },
  });

  const field = "rounded-lg border border-border bg-card px-3 py-2 text-sm";
  const heading = [s.category ?? "Properties", s.purpose === "sale" ? "for Sale" : s.purpose === "rent" ? "for Rent" : "", s.city ? `in ${s.city}` : s.state ? `in ${s.state}` : "in Nigeria"].filter(Boolean).join(" ");

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <h1 className="text-3xl font-bold">{heading}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Contact owners directly — no agent or agency fee.</p>

        <form onSubmit={(e) => { e.preventDefault(); set({ q: q || undefined }); }} className="mt-6 grid gap-3 rounded-xl bg-card p-4 shadow-card md:grid-cols-6">
          <div className="flex items-center gap-2 rounded-lg border border-border px-3 md:col-span-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Area, street or keyword" className="w-full bg-transparent py-2 text-sm outline-none" />
          </div>
          <select className={field} value={s.state ?? ""} onChange={(e) => set({ state: e.target.value || undefined, city: undefined })}>
            <option value="">All states</option>{STATES.map((x) => <option key={x}>{x}</option>)}
          </select>
          <select className={field} value={s.category ?? ""} onChange={(e) => set({ category: e.target.value || undefined })}>
            <option value="">All types</option>{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}
          </select>
          <select className={field} value={s.purpose ?? ""} onChange={(e) => set({ purpose: e.target.value || undefined })}>
            <option value="">Rent or Sale</option><option value="rent">For Rent</option><option value="sale">For Sale</option>
          </select>
          <select className={field} value={s.sort ?? ""} onChange={(e) => set({ sort: e.target.value || undefined })}>
            <option value="">Newest</option><option value="low">Price: Low to High</option><option value="high">Price: High to Low</option>
          </select>
          <input type="number" placeholder="Min price (₦)" className={field} defaultValue={s.min} onBlur={(e) => set({ min: e.target.value ? Number(e.target.value) : undefined })} />
          <input type="number" placeholder="Max price (₦)" className={field} defaultValue={s.max} onBlur={(e) => set({ max: e.target.value ? Number(e.target.value) : undefined })} />
          <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">Search</button>
          <button type="button" onClick={() => { setQ(""); navigate({ search: {} }); }} className="rounded-lg border border-border px-4 py-2 text-sm">Clear</button>
        </form>

        <div className="mt-8">
          {isLoading ? (
            <p className="text-muted-foreground">Loading properties…</p>
          ) : !data?.length ? (
            <div className="rounded-xl bg-card p-10 text-center shadow-card">
              <p className="font-semibold">No properties match yet.</p>
              <p className="mt-1 text-sm text-muted-foreground">Try another area or clear the filters.</p>
            </div>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted-foreground">{data.length} found</p>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{data.map((l) => <ListingCard key={l.id} l={l} />)}</div>
            </>
          )}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
