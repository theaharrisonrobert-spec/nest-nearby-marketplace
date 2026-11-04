import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Bath, BedDouble, CalendarClock, CheckCircle2, Flag, Landmark, MapPin, Send, Square } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { TrustBadges } from "@/components/TrustBadges";
import { formatNaira, LISTING_COLS, listingImage, PERIODS } from "@/lib/listings";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/listings/$id")({
  head: () => ({
    meta: [
      { title: "Property details — RentReady" },
      { name: "description", content: "See price, location, amenities and verification badges, then message the owner privately on RentReady." },
      { property: "og:title", content: "Property details — RentReady" },
      { property: "og:description", content: "Message the owner privately and request a viewing." },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Detail,
});

const REASONS = [
  ["fraud", "Fraud or scam"],
  ["wrong_price", "Inaccurate price"],
  ["duplicate", "Duplicate listing"],
  ["unavailable", "No longer available"],
  ["other", "Something else"],
] as const;

function Detail() {
  const { id } = Route.useParams();
  const { user } = useSession();
  const [msg, setMsg] = useState("");
  const [when, setWhen] = useState("");
  const [note, setNote] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: l, isLoading } = useQuery({
    queryKey: ["listing", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS).eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: badges } = useQuery({
    queryKey: ["badges", l?.owner_id],
    enabled: !!l?.owner_id,
    queryFn: async () => {
      if (!l?.owner_id) return null;
      return (await supabase.rpc("owner_badges", { _owner: l.owner_id })).data?.[0] ?? null;
    },
  });
  const { data: address } = useQuery({
    queryKey: ["address", id],
    queryFn: async () => (await supabase.rpc("listing_address", { _id: id })).data ?? null,
  });

  const isOwner = !!user && user.id === l?.owner_id;
  const canContact = !!l?.owner_id && !isOwner;

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !l?.owner_id) return;
    const body = msg.trim();
    if (!body || body.length > 2000) { toast.error("Write a message (up to 2000 characters)"); return; }
    setBusy(true);
    const { error } = await supabase.from("messages").insert({ listing_id: l.id, sender_id: user.id, recipient_id: l.owner_id, body });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setMsg("");
    toast.success("Message sent. Replies appear in your Messages.");
  }

  async function requestViewing(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !l?.owner_id) return;
    const d = new Date(when);
    if (!when || isNaN(+d) || d < new Date()) { toast.error("Pick a future date and time"); return; }
    setBusy(true);
    const { error } = await supabase.from("viewings").insert({ listing_id: l.id, owner_id: l.owner_id, requester_id: user.id, requested_at: d.toISOString(), note: note.trim().slice(0, 500) || null });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setWhen(""); setNote("");
    toast.success("Viewing requested. The owner will accept, decline or suggest another time.");
  }

  async function report(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!user || !l) return;
    const f = new FormData(e.currentTarget);
    const { error } = await supabase.from("reports").insert({ listing_id: l.id, reporter_id: user.id, reason: String(f.get("reason")), details: String(f.get("details") || "").slice(0, 1000) || null });
    if (error) { toast.error(error.message); return; }
    await supabase.from("admin_notifications").insert({ user_id: user.id, kind: "report", message: `Listing reported: ${l.title}` });
    setReportOpen(false);
    toast.success("Thank you. Our team will review this listing.");
  }

  const card = "rounded-xl bg-card p-6 shadow-card";
  const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  const signInCta = (what: string) => (
    <Link to="/auth" search={{ mode: "signin", next: `/listings/${id}` }} className="block rounded-lg bg-primary py-3 text-center font-medium text-primary-foreground">Sign in to {what}</Link>
  );

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <Link to="/listings" className="text-sm text-primary">← Back to properties</Link>
        {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : !l ? (
          <p className="mt-6">This property is no longer available.</p>
        ) : (
          <div className="mt-4 grid gap-8 lg:grid-cols-[2fr_1fr]">
            <div className="space-y-6">
              {l.is_sample && (
                <div className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
                  <strong className="text-foreground">Sample listing.</strong> This shows how listings look on RentReady. It is not a real property and cannot be rented or bought.
                </div>
              )}
              <img src={listingImage(l)} alt={l.title} className="aspect-[16/10] w-full rounded-xl object-cover" />
              <div className={card}>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-md bg-primary px-2 py-1 text-xs font-medium text-primary-foreground">{l.purpose === "sale" ? "For Sale" : "For Rent"}</span>
                  {l.sponsored && <span className="rounded-md bg-accent px-2 py-1 text-xs font-semibold text-accent-foreground">Sponsored</span>}
                  <span className="text-xs leading-6 text-muted-foreground">{l.category}</span>
                </div>
                <div className="mt-3 text-3xl font-bold text-primary">{formatNaira(l.price)} <span className="text-base font-normal text-foreground">{PERIODS[l.price_period]}</span>
                  {l.negotiable && <span className="ml-2 rounded bg-brand-soft px-2 py-0.5 text-xs font-medium text-primary">Negotiable</span>}</div>
                <h1 className="mt-2 text-2xl font-bold">{l.title}</h1>
                <div className="mt-2 flex items-center gap-1 text-sm text-muted-foreground"><MapPin className="h-4 w-4" />{[address, l.city, l.state].filter(Boolean).join(", ")}</div>
                <div className="mt-5 flex flex-wrap gap-6 text-sm">
                  {l.bedrooms != null && <span className="flex items-center gap-2"><BedDouble className="h-5 w-5 text-primary" />{l.bedrooms} Bedrooms</span>}
                  {l.bathrooms != null && <span className="flex items-center gap-2"><Bath className="h-5 w-5 text-primary" />{l.bathrooms} Bathrooms</span>}
                  {l.size_sqft != null && <span className="flex items-center gap-2"><Square className="h-5 w-5 text-primary" />{l.size_sqft.toLocaleString()} sqft</span>}
                </div>
                {l.description && <p className="mt-6 whitespace-pre-line leading-relaxed text-foreground/85">{l.description}</p>}
              </div>

              {l.amenities.length > 0 && (
                <div className={card}>
                  <h2 className="text-lg font-bold">Amenities</h2>
                  <ul className="mt-3 grid gap-2 sm:grid-cols-3">
                    {l.amenities.map((a) => <li key={a} className="flex items-center gap-2 text-sm"><CheckCircle2 className="h-4 w-4 text-primary" />{a}</li>)}
                  </ul>
                </div>
              )}

              <div className={card}>
                <h2 className="text-lg font-bold">Location</h2>
                <p className="mt-1 text-xs text-muted-foreground">{address ? "Address shared by the owner." : "General area only — the exact address is shared by the owner when you arrange a viewing."}</p>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <iframe title="Map" loading="lazy" className="h-56 w-full rounded-lg border border-border" src={`https://www.google.com/maps?q=${encodeURIComponent(`${l.city}, ${l.state}, Nigeria`)}&z=13&output=embed`} />
                  <div>
                    <div className="text-sm font-semibold">Nearby landmarks</div>
                    {l.landmarks ? (
                      <ul className="mt-2 space-y-2 text-sm">
                        {l.landmarks.split(/[\n,]/).map((x) => x.trim()).filter(Boolean).map((x) => <li key={x} className="flex items-center gap-2"><Landmark className="h-4 w-4 text-primary" />{x}</li>)}
                      </ul>
                    ) : <p className="mt-2 text-sm text-muted-foreground">The owner hasn't added landmarks yet.</p>}
                  </div>
                </div>
              </div>
            </div>

            <aside className="h-fit space-y-4 lg:sticky lg:top-6">
              <div className={card}>
                <div className="text-sm text-muted-foreground">Listed by</div>
                <div className="text-lg font-semibold">{badges?.agency_name || l.contact_name || "Property owner"}</div>
                <TrustBadges identity={!!badges?.identity_verified} agency={!!badges?.agency_verified} reviewed={l.details_reviewed} accountType={badges?.account_type} />
              </div>

              {isOwner ? (
                <div className={card}><p className="text-sm">This is your listing. Manage enquiries and viewings in your <Link to="/dashboard" className="font-medium text-primary">dashboard</Link>.</p></div>
              ) : canContact && !l.is_sample ? (
                <>
                  <form onSubmit={sendMessage} className={card}>
                    <h2 className="font-bold">Interested in this property?</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Messages are private — nobody's phone number is shown publicly.</p>
                    {user ? (
                      <>
                        <textarea value={msg} onChange={(e) => setMsg(e.target.value)} maxLength={2000} rows={3} placeholder="Hi, I'm interested in this property…" className={`${input} mt-3`} />
                        <button disabled={busy} className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60"><Send className="h-4 w-4" />Send Message</button>
                      </>
                    ) : <div className="mt-3">{signInCta("message the owner")}</div>}
                  </form>
                  <form onSubmit={requestViewing} className={card}>
                    <h2 className="flex items-center gap-2 font-bold"><CalendarClock className="h-5 w-5 text-primary" />Request a viewing</h2>
                    {user ? (
                      <>
                        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`${input} mt-3`} />
                        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder="Note for the owner (optional)" className={`${input} mt-2`} />
                        <button disabled={busy} className="mt-3 w-full rounded-lg border border-primary py-3 font-medium text-primary disabled:opacity-60">Request Viewing</button>
                      </>
                    ) : <div className="mt-3">{signInCta("request a viewing")}</div>}
                  </form>
                </>
              ) : null}

              <div className={card}>
                <p className="text-xs text-muted-foreground">Safety tip: always inspect a property in person and confirm ownership documents before paying any money.</p>
                {!isOwner && (user ? (
                  reportOpen ? (
                    <form onSubmit={report} className="mt-3 space-y-2">
                      <select name="reason" className={input}>{REASONS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                      <textarea name="details" maxLength={1000} rows={2} placeholder="Tell us more (optional)" className={input} />
                      <div className="flex gap-2"><button className="flex-1 rounded-lg bg-destructive py-2 text-sm font-medium text-destructive-foreground">Submit report</button><button type="button" onClick={() => setReportOpen(false)} className="rounded-lg border border-border px-3 text-sm">Cancel</button></div>
                    </form>
                  ) : <button onClick={() => setReportOpen(true)} className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive"><Flag className="h-4 w-4" />Report this listing</button>
                ) : <Link to="/auth" search={{ mode: "signin", next: `/listings/${id}` }} className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive"><Flag className="h-4 w-4" />Sign in to report</Link>)}
              </div>
            </aside>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
