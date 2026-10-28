import { Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Bath, BedDouble, Heart, MapPin, Square } from "lucide-react";
import { type Listing, formatNaira, listingImage, PERIODS } from "@/lib/listings";

export function ListingCard({ l }: { l: Listing }) {
  const [fav, setFav] = useState(false);
  useEffect(() => {
    setFav(JSON.parse(localStorage.getItem("rr-favs") || "[]").includes(l.id));
  }, [l.id]);
  function toggle(e: React.MouseEvent) {
    e.preventDefault();
    const favs: string[] = JSON.parse(localStorage.getItem("rr-favs") || "[]");
    const next = fav ? favs.filter((x) => x !== l.id) : [...favs, l.id];
    localStorage.setItem("rr-favs", JSON.stringify(next));
    setFav(!fav);
  }
  return (
    <Link to="/listings/$id" params={{ id: l.id }} className="block overflow-hidden rounded-xl bg-card p-2 shadow-card transition hover:-translate-y-1">
      <div className="relative">
        <img src={listingImage(l)} alt={l.title} loading="lazy" className="aspect-[16/10] w-full rounded-lg object-cover" />
        <span className="absolute left-2 top-2 rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">
          {l.purpose === "sale" ? "For Sale" : "For Rent"}
        </span>
        <button onClick={toggle} aria-label="Save" className="absolute right-2 top-2 text-ink-foreground">
          <Heart className={`h-6 w-6 drop-shadow ${fav ? "fill-destructive text-destructive" : ""}`} />
        </button>
      </div>
      <div className="p-3">
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
