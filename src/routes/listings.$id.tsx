import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bath, BedDouble, MapPin, MessageCircle, Phone, ShieldCheck, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { formatNaira, listingImage, PERIODS, whatsappLink } from "@/lib/listings";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "Property details — RentReady" },
      { name: "description", content: "See price, location and features, then contact the owner directly on RentReady." },
      { property: "og:title", content: "Property details — RentReady" },
      { property: "og:description", content: "Contact the owner directly, no agent needed." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

function Detail() {
  const { id } = Route.useParams();
  const { data: l, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link to="/listings" className="text-sm text-primary">← Back to properties</Link>
        {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : !l ? (
          <p className="mt-6">This property is no longer available.</p>
        ) : (
          <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div>
              <img src={listingImage(l)} alt={l.title} className="aspect-[16/10] w-full rounded-xl object-cover" />
              <div className="mt-6 rounded-xl bg-card p-6 shadow-card">
                <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">{l.purpose === "sale" ? "For Sale" : "For Rent"}</span>
                <span className="ml-2 text-xs text-muted-foreground">{l.category}</span>
                <h1 className="mt-3 text-3xl font-bold">{l.title}</h1>
                <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{[l.address, l.city, l.state].filter(Boolean).join(", ")}</div>
                <div className="mt-5 flex flex-wrap gap-6 text-sm">
                  {l.bedrooms != null && <span className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />{l.bedrooms} Bedrooms</span>}
                  {l.bathrooms != null && <span className="flex items-center gap-2"><Bath className="h-5 w-5 text-primary" />{l.bathrooms} Bathrooms</span>}
                  {l.size_sqft != null && <span className="flex items-center gap-2"><Square className="h-5 w-5 text-primary" />{l.size_sqft.toLocaleString()} sqft</span>}
                </div>
                {l.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground/85">{l.description}</p>}
              </div>
            </div>
            <aside className="h-fit space-y-4 rounded-xl bg-card p-6 shadow-card lg:sticky lg:top-6">
              <div className="text-3xl font-bold text-primary">{formatNaira(l.price)} <span className="text-base font-normal text-foreground">{PERIODS[l.price_period]}</span></div>
              <div className="text-sm text-muted-foreground">Price set by the owner{l.negotiable ? " · Negotiable" : ""}</div>
              <div className="rounded-lg bg-brand-soft p-3 text-sm"><ShieldCheck className="mr-1 inline h-4 w-4 text-primary" />No agent needed — talk directly to {l.contact_name || "the owner"}.</div>
              <a href={whatsappLink(l.contact_phone, l.title)} target="_blank" rel="noreferrer" className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground">
                <MessageCircle className="h-5 w-5" /> Chat on WhatsApp
              </a>
              <a href={`tel:${l.contact_phone}`} className="flex w-full items-center justify-center gap-2 rounded-lg border border-primary py-3 font-medium text-primary">
                <Phone className="h-5 w-5" /> Call {l.contact_phone}
              </a>
              <p className="text-xs text-muted-foreground">Safety tip: always inspect the property in person before paying any money.</p>
            </aside>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
