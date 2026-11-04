import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, CalendarClock, Eye, Home, MessageSquare, Plus, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountType, canRequestPromotion } from "@/lib/marketplace-rules";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { TrustBadges } from "@/components/TrustBadges";
import { ACCOUNT_TYPES, formatNaira, LISTING_COLS, PERIODS } from "@/lib/listings";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — RentReady Business" },
      { name: "description", content: "Manage your listings, enquiries and viewing appointments on RentReady." },
      { property: "og:title", content: "Dashboard — RentReady Business" },
      { property: "og:description", content: "Your RentReady workspace." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const STATUS_STYLE: Record<string, string> = {
  approved: "bg-brand-soft text-primary",
  pending: "bg-muted text-foreground",
  rejected: "bg-destructive/10 text-destructive",
  unavailable: "bg-muted text-muted-foreground",
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [suggest, setSuggest] = useState<Record<string, string>>({});

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("full_name, account_type, agency_name, agency_verified, verification_status").eq("id", user.id).maybeSingle()).data,
  });
  const { data: listings = [] } = useQuery({
    queryKey: ["my-listings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(`${LISTING_COLS}, promotion_requested`).eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: viewings = [] } = useQuery({
    queryKey: ["viewings", user.id],
    queryFn: async () => (await supabase.from("viewings").select("*, listings(title)").order("requested_at", { ascending: true })).data ?? [],
  });
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user.id],
    queryFn: async () => (await supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null)).count ?? 0,
  });

  const type = accountType(profile?.account_type);
  const isBusiness = type === "landlord";
  const incoming = viewings.filter((v) => v.owner_id === user.id);
  const mine = viewings.filter((v) => v.requester_id === user.id);

  async function removeListing(id: string) {
    if (!window.confirm("Delete this listing? It will be removed from RentReady, including its messages and viewing requests.")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    await qc.invalidateQueries({ queryKey: ["my-listings"] });
    await qc.invalidateQueries({ queryKey: ["listings"] });
    await qc.invalidateQueries({ queryKey: ["viewings"] });
  }
  async function requestPromotion(id: string) {
    const { error } = await supabase.from("listings").update({ promotion_requested: true }).eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Promotion requested. Our team will contact you about pricing and payment.");
    await qc.invalidateQueries({ queryKey: ["my-listings"] });
  }
  async function updateViewing(id: string, patch: { status: string; proposed_at?: string }) {
    const { error } = await supabase.from("viewings").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Viewing updated");
    qc.invalidateQueries({ queryKey: ["viewings"] });
  }
  async function markUnavailable(id: string) {
    const { error } = await supabase.from("listings").update({ status: "unavailable" }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  }

  const stat = (Icon: typeof Home, label: string, value: number | string) => (
    <div className="rounded-xl bg-card p-5 shadow-card">
      <Icon className="h-5 w-5 text-primary" />
      <div className="mt-2 text-2xl font-bold">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
  const fmt = (d: string) => new Date(d).toLocaleString("en-NG", { dateStyle: "medium", timeStyle: "short" });

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="text-xs font-semibold tracking-widest text-primary">{isBusiness ? "RENTREADY BUSINESS" : "RENTREADY"}</div>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{isBusiness ? `${ACCOUNT_TYPES[type].short} Dashboard` : "My Dashboard"}</h1>
            <p className="text-muted-foreground">Welcome{profile?.full_name ? `, ${profile.full_name}` : ""}.</p>
            {profile?.verification_status === "approved" && <p className="mt-2 flex items-center gap-2 text-sm font-semibold text-primary"><BadgeCheck className="h-5 w-5" />Verified identity</p>}
          </div>
          <div className="flex gap-2">
            <span className="py-2 text-sm text-muted-foreground">{ACCOUNT_TYPES[type].label}</span>
            {isBusiness && <Link to="/post" className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />New listing</Link>}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isBusiness && stat(Home, "Live listings", listings.filter((l) => l.status === "approved").length)}
          {isBusiness && stat(Eye, "Awaiting review", listings.filter((l) => l.status === "pending").length)}
          {stat(MessageSquare, "Unread messages", unread)}
          {stat(CalendarClock, isBusiness ? "Viewing requests to answer" : "My viewing requests", isBusiness ? incoming.filter((v) => v.status === "pending").length : mine.length)}
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            {isBusiness && (
              <section className="rounded-xl bg-card p-6 shadow-card">
                <h2 className="text-lg font-bold">Viewing requests</h2>
                {incoming.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No viewing requests yet.</p> : (
                  <ul className="mt-3 divide-y divide-border">
                    {incoming.map((v) => (
                      <li key={v.id} className="py-3 text-sm">
                        <div className="flex flex-wrap justify-between gap-2">
                          <span className="font-medium">{v.listings?.title}</span>
                          <span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{v.status}</span>
                        </div>
                        <div className="text-muted-foreground">Requested: {fmt(v.requested_at)}{v.proposed_at ? ` · You suggested ${fmt(v.proposed_at)}` : ""}</div>
                        {v.note && <div className="text-muted-foreground">“{v.note}”</div>}
                        {v.status === "pending" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button onClick={() => updateViewing(v.id, { status: "accepted" })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Accept</button>
                            <button onClick={() => updateViewing(v.id, { status: "declined" })} className="rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive">Decline</button>
                            <input type="datetime-local" value={suggest[v.id] ?? ""} onChange={(e) => setSuggest({ ...suggest, [v.id]: e.target.value })} className="rounded-lg border border-border px-2 text-xs" />
                            <Button size="sm" variant="outline" disabled={!suggest[v.id]} onClick={() => { const time = suggest[v.id]; if (time) void updateViewing(v.id, { status: "rescheduled", proposed_at: new Date(time).toISOString() }); }}>Suggest time</Button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {isBusiness && (
              <section className="rounded-xl bg-card p-6 shadow-card">
                <h2 className="text-lg font-bold">My listings</h2>
                {listings.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No listings yet. <Link to="/post" className="text-primary">Post your first property</Link>.</p> : (
                  <ul className="mt-3 divide-y divide-border">
                    {listings.map((l) => (
                      <li key={l.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                        <div>
                          <Link to="/listings/$id" params={{ id: l.id }} className="font-medium hover:text-primary">{l.title}</Link>
                          <div className="text-xs text-muted-foreground">{formatNaira(l.price)} {PERIODS[l.price_period]} · {l.city}, {l.state} · {l.purpose === "sale" ? "For Sale" : "For Rent"}</div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          {l.sponsored && <span className="rounded bg-accent px-2 py-0.5 text-xs text-accent-foreground">Sponsored</span>}
                          <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[l.status] ?? ""}`}>{l.status === "pending" ? "Awaiting review" : l.status}</span>
                          {l.status === "approved" && <button onClick={() => markUnavailable(l.id)} className="text-xs text-muted-foreground underline">Mark let/sold</button>}
                          {l.promotion_requested && !l.sponsored && <span className="text-xs text-primary">Promotion requested</span>}
                          {canRequestPromotion(l) && <Button size="sm" variant="outline" disabled={profile?.verification_status !== "approved"} onClick={() => requestPromotion(l.id)}><Sparkles />Promote</Button>}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeListing(l.id)}><Trash2 />Delete</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            <section className="rounded-xl bg-card p-6 shadow-card">
              <h2 className="text-lg font-bold">Viewings I've requested</h2>
              {mine.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None yet. <Link to="/listings" className="text-primary">Browse properties</Link>.</p> : (
                <ul className="mt-3 divide-y divide-border">
                  {mine.map((v) => (
                    <li key={v.id} className="py-3 text-sm">
                      <div className="flex justify-between gap-2"><span className="font-medium">{v.listings?.title}</span><span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{v.status}</span></div>
                      <div className="text-muted-foreground">{fmt(v.requested_at)}{v.proposed_at ? ` · Owner suggested ${fmt(v.proposed_at)}` : ""}</div>
                      {v.status === "rescheduled" && v.proposed_at && (
                        <div className="mt-2 flex gap-2">
                          <button onClick={() => updateViewing(v.id, { status: "accepted" })} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Accept new time</button>
                          <button onClick={() => updateViewing(v.id, { status: "cancelled" })} className="rounded-lg border border-border px-3 py-1.5 text-xs">Cancel</button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>

          <aside className="space-y-6">
            <section className="rounded-xl bg-card p-6 shadow-card">
              <h2 className="font-bold">Your badges</h2>
              <TrustBadges identity={profile?.verification_status === "approved"} agency={false} reviewed={false} accountType={type} />
              {profile?.verification_status !== "approved" && (
                <Link to="/verify" className="mt-4 block rounded-lg border border-primary py-2 text-center text-sm font-medium text-primary">
                  {profile?.verification_status === "pending" ? "Verification under review" : "Verify your identity"}
                </Link>
              )}
            </section>
            <Link to="/messages" className="flex items-center justify-between rounded-xl bg-card p-6 shadow-card hover:ring-1 hover:ring-primary">
              <span className="flex items-center gap-2 font-bold"><MessageSquare className="h-5 w-5 text-primary" />Messages</span>
              {unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{unread}</span>}
            </Link>
            {isBusiness && (
              <section className="rounded-xl bg-ink p-6 text-ink-foreground shadow-card">
                <Sparkles className="h-6 w-6 text-brand" />
                <h2 className="mt-2 font-bold">Featured promotion</h2>
                <p className="mt-1 text-sm text-ink-foreground/75">Posting is free. Request promotion on a live listing above. Our team will confirm the price and payment before activating it. Promoted listings are labelled "Sponsored".</p>
              </section>
            )}
          </aside>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
