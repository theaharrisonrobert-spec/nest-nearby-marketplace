import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bath, BedDouble, Heart, MapPin, Square } from "lucide-react";
import { type Listing, formatNaira, listingImage, PERIODS } from "@/lib/listings";
import { useSession } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";

export function ListingCard({ l }: { l: Listing }) {
  const [fav, setFav] = useState(false);
  const { user } = useSession();
  const { data: profile } = useQuery({
    queryKey: ["favorite-approval", user?.id], enabled: !!user,
    queryFn: async () => user ? (await supabase.from("profiles").select("approval_status, is_blocked").eq("id", user.id).maybeSingle()).data : null,
  });
  const canSave = !!user && profile?.approval_status === "approved" && !profile.is_blocked;
  useEffect(() => {
    setFav(JSON.parse(localStorage.getItem("rr-favs") || "[]").includes(l.id));
  }, [l.id]);
  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!canSave) return;
    const favs: string[] = JSON.parse(localStorage.getItem("rr-favs") || "[]");
    const next = fav ? favs.filter((x) => x !== l.id) : [...favs, l.id];
    localStorage.setItem("rr-favs", JSON.stringify(next));
    setFav(!fav);
  }
  return (
    <Link to="/listings/$id" params={{ id: l.id }} className="block overflow-hidden rounded-xl bg-card p-2 shadow-card transition hover:-translate-y-1">
      <div className="relative">
        <img src={listingImage(l)} alt={l.title} loading="lazy" className="aspect-[16/10] w-full rounded-lg object-cover" />
        <button type="button" onClick={toggle} disabled={!canSave} title={canSave ? "Save property" : "Sign in and get approved to save properties"} aria-label="Save" className="absolute right-2 top-2 text-ink-foreground disabled:cursor-not-allowed disabled:opacity-50">
          <Heart className={`h-6 w-6 drop-shadow ${fav ? "fill-destructive text-destructive" : ""}`} />
        </button>
      </div>
      <div className="p-3">
        <div className="mb-2 flex flex-wrap gap-1">
          <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-white">{l.purpose === "sale" ? "For Sale" : "For Rent"}</span>
          {l.sponsored && <span className="rounded-md bg-accent px-2 py-0.5 text-[10px] font-semibold uppercase text-accent-foreground">Sponsored</span>}
          {l.featured_until && new Date(l.featured_until).getTime() > Date.now() && <span className="rounded-md bg-primary px-2 py-0.5 text-[10px] font-semibold uppercase text-white">Featured</span>}
          {l.early_access_until && new Date(l.early_access_until).getTime() > Date.now() && <span className="rounded-md bg-primary/90 px-2 py-0.5 text-[10px] font-semibold uppercase text-white">Early Access</span>}
          {!l.is_sample && <span className="rounded-md bg-white px-2 py-0.5 text-[10px] font-semibold text-primary">No Agent Fee</span>}
          {l.is_sample && <span className="rounded-md bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase text-ink-foreground">Sample listing</span>}
          {l.status && l.status !== "approved" && <span className="rounded-md bg-muted px-2 py-0.5 text-[10px] font-semibold uppercase text-foreground">{l.status === "pending" ? "Awaiting review" : l.status}</span>}
        </div>
        <h3 className="font-semibold">{l.title}</h3>
        <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{l.city}, {l.state}</div>
        <div className="mt-2 text-lg font-bold text-primary">
          {formatNaira(l.price)} <span className="text-sm font-normal text-foreground">{PERIODS[l.price_period]}</span>
          {l.negotiable && <span className="ml-2 rounded bg-brand-soft px-1.5 py-0.5 text-[10px] font-medium text-primary">Negotiable</span>}
        </div>
        <div className="mt-3 flex gap-5 text-xs text-muted-foreground">
          {l.bedrooms != null && <span className="flex items-center gap-1"><BedDouble className="h-4 w-4" />{l.bedrooms} Beds</span>}
          {l.bathrooms != null && <span className="flex items-center gap-1"><Bath className="h-4 w-4" />{l.bathrooms} Baths</span>}
          {l.size_sqft != null && <span className="flex items-center gap-1"><Square className="h-4 w-4" />{l.size_sqft.toLocaleString()} sqft</span>}
        </div>
      </div>
    </Link>
  );
}
