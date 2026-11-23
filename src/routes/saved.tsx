import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Heart, MapPin, Trash2 } from "lucide-react";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, LISTING_COLS, listingImage, PERIODS, type Listing } from "@/lib/listings";

export const Route = createFileRoute("/saved")({
  head: () => ({ meta: [{ title: "Saved Properties — RentReady" }, { name: "description", content: "View the properties you saved on RentReady." }] }),
  component: SavedPage,
});

function SavedPage() {
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const value: unknown = JSON.parse(localStorage.getItem("rr-favs") || "[]");
      setSavedIds(Array.isArray(value) ? value.filter((id): id is string => typeof id === "string").slice(0, 100) : []);
    } catch {
      setSavedIds([]);
    }
    setLoaded(true);
  }, []);

  const { data: listings = [], isLoading, isError } = useQuery({
    queryKey: ["saved-page-listings", savedIds],
    enabled: loaded && savedIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS)
        .in("id", savedIds).eq("status", "approved").eq("availability_status", "available").eq("is_sample", false);
      if (error) throw error;
      const byId = new Map((data ?? []).map((listing) => [listing.id, listing]));
      return savedIds.map((id) => byId.get(id)).filter((listing): listing is Listing => !!listing);
    },
  });

  function removeSaved(id: string) {
    const next = savedIds.filter((savedId) => savedId !== id);
    localStorage.setItem("rr-favs", JSON.stringify(next));
    setSavedIds(next);
  }

  return <div className="min-h-screen bg-muted/40">
    <SiteHeader />
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-5 sm:py-12">
      <div className="flex items-center gap-3"><Heart className="h-7 w-7 fill-primary text-primary" /><div><h1 className="text-3xl font-bold">Saved properties</h1><p className="mt-1 text-sm text-muted-foreground">Keep the places you want to come back to.</p></div></div>
      {!loaded || isLoading ? <p className="mt-8 text-muted-foreground">Loading saved properties…</p> : isError ? <p role="alert" className="mt-8 text-muted-foreground">Could not load saved properties. Please try again.</p> : listings.length === 0 ? (
        <div className="mt-8 rounded-xl bg-card p-8 text-center shadow-card"><p className="font-semibold">No saved properties yet.</p><p className="mt-2 text-sm text-muted-foreground">Browse listings and tap the heart to save a property.</p><Link to="/listings" className="mt-5 inline-flex rounded-lg bg-primary px-5 py-3 font-semibold text-white">Search properties</Link></div>
      ) : (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {listings.map((listing) => <li key={listing.id} className="overflow-hidden rounded-xl bg-card shadow-card">
            <Link to="/listings/$id" params={{ id: listing.id }} className="block"><img src={listingImage(listing)} alt={listing.title} className="aspect-[16/10] w-full object-cover" /><div className="p-4"><h2 className="font-semibold">{listing.title}</h2><p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{listing.city}, {listing.state}</p><p className="mt-2 font-bold text-primary">{formatNaira(listing.price)} <span className="font-normal text-foreground">{PERIODS[listing.price_period]}</span></p></div></Link>
            <button type="button" onClick={() => removeSaved(listing.id)} className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-3 text-sm font-medium text-muted-foreground hover:text-destructive"><Trash2 className="h-4 w-4" />Remove from saved</button>
          </li>)}
        </ul>
      )}
    </main>
    <SiteFooter />
  </div>;
}
