import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { toast } from "sonner";
import { BadgeCheck, CalendarClock, Eye, Home, MessageSquare, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { accountType } from "@/lib/marketplace-rules";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { TrustBadges } from "@/components/TrustBadges";
import { ACCOUNT_TYPES, formatNaira, LISTING_COLS, PERIODS } from "@/lib/listings";
import { cancelPaidPlan, cancelTenantPremium, startPaidPlan, startTenantPremiumCheckout } from "@/lib/payments";

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
  available: "bg-brand-soft text-primary",
  rented: "bg-muted text-muted-foreground",
  expired: "bg-destructive/10 text-destructive",
};

function Dashboard() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();

  const { data: profile } = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => (await supabase.from("profiles").select("full_name, account_type, agency_name, agency_verified, verification_status, phone_verified_at").eq("id", user.id).maybeSingle()).data,
  });
  const { data: listings = [] } = useQuery({
    queryKey: ["my-listings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS).eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
  const [savedListingIds, setSavedListingIds] = useState<string[]>([]);
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("rr-favs") || "[]");
      setSavedListingIds(Array.isArray(saved) ? saved.filter((id): id is string => typeof id === "string").slice(0, 100) : []);
    } catch { setSavedListingIds([]); }
  }, []);
  const { data: savedListings = [] } = useQuery({
    queryKey: ["tenant-saved-listings", user.id, savedListingIds],
    enabled: profile?.account_type === "tenant" && savedListingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS).in("id", savedListingIds)
        .eq("status", "approved").eq("availability_status", "available").eq("is_sample", false);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: newListingsToday = [] } = useQuery({
    queryKey: ["tenant-new-listings-today", user.id],
    enabled: profile?.account_type === "tenant",
    queryFn: async () => {
      const now = new Date();
      const start = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const { data, error } = await supabase.from("listings").select(LISTING_COLS)
        .eq("status", "approved").eq("availability_status", "available").eq("is_sample", false)
        .gte("created_at", start).order("created_at", { ascending: false }).limit(6);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: viewings = [] } = useQuery({
    queryKey: ["viewings", user.id],
    queryFn: async () => (await supabase.from("viewings").select("*, listings(title)").order("requested_at", { ascending: true })).data ?? [],
  });
  const { data: ratings = [] } = useQuery({
    queryKey: ["viewing-ratings", user.id],
    queryFn: async () => (await supabase.from("viewing_ratings").select("viewing_id, rater_id").eq("rater_id", user.id)).data ?? [],
  });
  const [ratingStars, setRatingStars] = useState<Record<string, number>>({});
  const [ratingAnswers, setRatingAnswers] = useState<Record<string, Record<string, boolean>>>({});
  const { data: unread = 0 } = useQuery({
    queryKey: ["unread", user.id],
    queryFn: async () => (await supabase.from("messages").select("id", { count: "exact", head: true }).eq("recipient_id", user.id).is("read_at", null)).count ?? 0,
  });
  const { data: subscriptions = [] } = useQuery({
    queryKey: ["subscriptions", user.id],
    queryFn: async () => (await supabase.from("subscriptions").select("id, plan, status, ends_at, cancel_at_period_end").eq("user_id", user.id).order("created_at", { ascending: false })).data ?? [],
  });
  const { data: tenantPlanRecord } = useQuery({
    queryKey: ["tenant-subscription", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("tenant_subscriptions")
        .select("id, status, current_period_end, cancel_at_period_end")
        .eq("user_id", user.id).eq("status", "active")
        .gt("current_period_end", new Date().toISOString())
        .order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const activePlan = (name: string) => subscriptions.some((plan) => plan.plan === name && plan.status === "active" && (!plan.ends_at || new Date(plan.ends_at).getTime() > Date.now()));
  const landlordPremium = activePlan("landlord_premium");
  const tenantPremium = !!tenantPlanRecord;
  const landlordPlanRecord = subscriptions.find((plan) => plan.plan === "landlord_premium" && plan.status === "active" && (!plan.ends_at || new Date(plan.ends_at).getTime() > Date.now()));
  const [alertAreas, setAlertAreas] = useState("");
  const [alertMinBudget, setAlertMinBudget] = useState("");
  const [alertMaxBudget, setAlertMaxBudget] = useState("");
  const { data: alertPreferences } = useQuery({
    queryKey: ["tenant-alert-preferences", user.id],
    enabled: tenantPremium,
    queryFn: async () => (await supabase.from("tenant_alert_preferences").select("areas, min_budget, max_budget").eq("user_id", user.id).maybeSingle()).data,
  });
  useEffect(() => {
    if (!alertPreferences) return;
    setAlertAreas(alertPreferences.areas.join(", "));
    setAlertMinBudget(alertPreferences.min_budget?.toString() ?? "");
    setAlertMaxBudget(alertPreferences.max_budget?.toString() ?? "");
  }, [alertPreferences]);
  const { data: tenantAlerts = [] } = useQuery({
    queryKey: ["tenant-alert-matches", user.id],
    enabled: tenantPremium,
    queryFn: async () => {
      const matches = (await supabase.from("tenant_alert_matches").select("id, listing_id, created_at, seen_at").order("created_at", { ascending: false }).limit(20)).data ?? [];
      if (matches.length === 0) return [];
      const listingIds = matches.map((match) => match.listing_id);
      const listingsById = (await supabase.from("listings").select("id, title, city, state, price").in("id", listingIds)).data ?? [];
      return matches.map((match) => ({ ...match, listing: listingsById.find((listing) => listing.id === match.listing_id) }));
    },
  });
  const { data: listingViewers = [] } = useQuery({
    queryKey: ["premium-listing-viewers", user.id],
    enabled: landlordPremium,
    queryFn: async () => (await supabase.rpc("premium_listing_viewers")).data ?? [],
  });
  const { data: listingViewCount = 0 } = useQuery({
    queryKey: ["landlord-listing-view-count", user.id],
    enabled: profile?.account_type === "landlord",
    queryFn: async () => (await supabase.rpc("owner_listing_view_count")).data ?? 0,
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
  async function updateViewing(id: string, action: "accept" | "decline" | "start" | "complete") {
    const result = action === "accept" || action === "decline"
      ? await supabase.rpc("respond_to_viewing", { _viewing_id: id, _accept: action === "accept" })
      : action === "start"
        ? await supabase.rpc("start_viewing", { _viewing_id: id })
        : await supabase.rpc("complete_viewing", { _viewing_id: id });
    const { error } = result;
    if (error) { toast.error(error.message); return; }
    toast.success(action === "accept" ? "Viewing accepted" : action === "decline" ? "Viewing declined" : action === "start" ? "Viewing marked as started" : "Your completion is recorded. The other person must confirm too.");
    await qc.invalidateQueries({ queryKey: ["viewings"] });
  }
  async function setListingAvailability(id: string, availability_status: "available" | "rented") {
    const { error } = await supabase.from("listings").update({ availability_status }).eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success(availability_status === "rented" ? "Listing marked as rented" : "Listing is available again");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
    qc.invalidateQueries({ queryKey: ["listings"] });
    qc.invalidateQueries({ queryKey: ["home-featured-approved-listings"] });
  }
  async function submitRating(viewing: (typeof viewings)[number]) {
    const stars = ratingStars[viewing.id] ?? 0;
    const answers = ratingAnswers[viewing.id] ?? {};
    const tenantSide = viewing.requester_id === user.id;
    const required = tenantSide ? ["real", "price", "polite"] : ["showed", "serious"];
    if (stars < 1 || required.some((key) => answers[key] === undefined)) { toast.error("Choose a star rating and answer each question"); return; }
    const answer = (key: string) => answers[key] ?? false;
    const { error } = await supabase.from("viewing_ratings").insert({
      viewing_id: viewing.id,
      rater_id: user.id,
      ratee_id: tenantSide ? viewing.owner_id : viewing.requester_id,
      overall_stars: stars,
      property_real: tenantSide ? answer("real") : null,
      price_same: tenantSide ? answer("price") : null,
      landlord_polite: tenantSide ? answer("polite") : null,
      tenant_showed_up: tenantSide ? null : answer("showed"),
      tenant_serious: tenantSide ? null : answer("serious"),
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Thank you for helping keep RentReady agent-free and trustworthy.");
    await qc.invalidateQueries({ queryKey: ["viewing-ratings", user.id] });
  }
  async function cancelRenewal(plan: "landlord_premium" | "tenant_premium") {
    const cancelled = plan === "tenant_premium" ? await cancelTenantPremium() : await cancelPaidPlan(plan);
    if (cancelled) await qc.invalidateQueries({ queryKey: [plan === "tenant_premium" ? "tenant-subscription" : "subscriptions", user.id] });
  }
  async function saveTenantAlerts(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const min = alertMinBudget.trim() ? Number(alertMinBudget) : null;
    const max = alertMaxBudget.trim() ? Number(alertMaxBudget) : null;
    if ((min !== null && (!Number.isFinite(min) || min < 0)) || (max !== null && (!Number.isFinite(max) || max < 0)) || (min !== null && max !== null && min > max)) {
      toast.error("Enter a valid budget range");
      return;
    }
    const areas = [...new Set(alertAreas.split(",").map((area) => area.trim()).filter(Boolean))].slice(0, 10);
    const { error } = await supabase.from("tenant_alert_preferences").upsert({ user_id: user.id, areas, min_budget: min, max_budget: max });
    if (error) { toast.error(error.message); return; }
    toast.success("Property alerts saved");
    await qc.invalidateQueries({ queryKey: ["tenant-alert-preferences", user.id] });
  }

  function ratingForm(viewing: (typeof viewings)[number]) {
    if (viewing.status !== "completed" && viewing.status !== "rated") return null;
    if (ratings.some((rating) => rating.viewing_id === viewing.id && rating.rater_id === user.id)) return <p className="mt-2 text-xs font-medium text-primary">You rated this viewing. Thank you.</p>;
    const tenantSide = viewing.requester_id === user.id;
    const questions: [string, string][] = tenantSide
      ? [["real", "Was the property real?"], ["price", "Was the price the same as online?"], ["polite", "Was the landlord polite?"]]
      : [["showed", "Did the tenant show up?"], ["serious", "Was the tenant serious?"]];
    const answers = ratingAnswers[viewing.id] ?? {};
    return <div className="mt-3 rounded-lg border border-border p-3">
      <p className="text-xs font-semibold">Rate {tenantSide ? "the landlord" : "the tenant"}</p>
      <div className="mt-2 flex gap-1" aria-label="Overall star rating">
        {[1, 2, 3, 4, 5].map((star) => <button key={star} type="button" aria-label={`${star} star${star === 1 ? "" : "s"}`} onClick={() => setRatingStars({ ...ratingStars, [viewing.id]: star })} className={`text-2xl ${star <= (ratingStars[viewing.id] ?? 0) ? "text-amber-500" : "text-muted-foreground/40"}`}>★</button>)}
      </div>
      <div className="mt-2 space-y-2">
        {questions.map(([key, label]) => <label key={key} className="flex items-center gap-2 text-xs"><input type="checkbox" checked={answers[key] ?? false} onChange={(event) => setRatingAnswers({ ...ratingAnswers, [viewing.id]: { ...answers, [key]: event.target.checked } })} />{label}</label>)}
      </div>
      <Button size="sm" className="mt-3" onClick={() => void submitRating(viewing)}>Submit rating</Button>
    </div>;
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
            {profile && !profile.phone_verified_at && <p className="mt-2 text-sm text-muted-foreground">Verify your phone to request viewings. <Link to="/verify-phone" className="font-semibold text-primary underline">Verify by SMS</Link></p>}
          </div>
          <div className="flex gap-2">
            <span className="py-2 text-sm text-muted-foreground">{ACCOUNT_TYPES[type].label}</span>
            {isBusiness && <Link to="/post" className="flex items-center gap-1 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"><Plus className="h-4 w-4" />New listing</Link>}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {isBusiness && stat(Home, "My listings", listings.length)}
          {isBusiness && stat(Eye, "Property views", listingViewCount)}
          {isBusiness && stat(Home, "Available listings", listings.filter((l) => l.status === "approved" && l.availability_status === "available").length)}
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
                        <div className="text-muted-foreground">Requested: {fmt(v.requested_at)}</div>
                        {v.status !== "requested" && v.viewing_code && <div className="mt-1 font-semibold text-primary">Viewing Code: {v.viewing_code}</div>}
                        {v.note && <div className="text-muted-foreground">“{v.note}”</div>}
                        {v.status === "requested" && (
                          <div className="mt-2 flex flex-wrap gap-2">
                            <button onClick={() => updateViewing(v.id, "accept")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Accept</button>
                            <button onClick={() => updateViewing(v.id, "decline")} className="rounded-lg border border-destructive px-3 py-1.5 text-xs text-destructive">Decline</button>
                          </div>
                        )}
                        {v.status === "accepted" && <div className="mt-2 flex flex-wrap items-center gap-3"><button onClick={() => updateViewing(v.id, "start")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Viewing Started</button><Link to="/listings/$id" params={{ id: v.listing_id }} className="text-xs font-medium text-primary underline">Chat directly with tenant</Link></div>}
                        {v.status === "met" && <div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">{v.landlord_completed_at ? "You marked this completed." : "Both people must mark the viewing completed."}</span>{!v.landlord_completed_at && <button onClick={() => updateViewing(v.id, "complete")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Viewing Completed</button>}<Link to="/listings/$id" params={{ id: v.listing_id }} className="text-xs font-medium text-primary underline">Chat directly with tenant</Link></div>}
                        {v.status === "completed" && <p className="mt-2 text-xs font-medium text-primary">Viewing completed by both people.</p>}
                        {ratingForm(v)}
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
                          {l.featured_until && new Date(l.featured_until).getTime() > Date.now() && <span className="rounded bg-primary px-2 py-0.5 text-xs text-white">Featured through {new Date(l.featured_until).toLocaleDateString("en-NG")}</span>}
                          <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[l.status] ?? ""}`}>{l.status === "pending" ? "Waiting for Admin Approval" : l.status === "rejected" ? `Rejected${l.rejection_reason ? `: ${l.rejection_reason}` : ""}` : "Approved"}</span>
                          {l.status === "approved" && <span className={`rounded px-2 py-0.5 text-xs capitalize ${STATUS_STYLE[l.availability_status] ?? ""}`}>{l.availability_status}</span>}
                          {l.status === "approved" && l.availability_status === "available" && <button onClick={() => void setListingAvailability(l.id, "rented")} className="text-xs text-muted-foreground underline">Mark as Rented</button>}
                          {l.status === "approved" && l.availability_status !== "available" && <button onClick={() => void setListingAvailability(l.id, "available")} className="text-xs text-primary underline">Mark as Available</button>}
                          {l.status === "approved" && (!l.featured_until || new Date(l.featured_until).getTime() <= Date.now()) && <Button size="sm" variant="outline" onClick={() => void startPaidPlan("featured_listing", l.id)}>Feature · ₦2,000 / 7 days</Button>}
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => removeListing(l.id)}><Trash2 />Delete</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )}

            {!isBusiness && <section className="rounded-xl bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">Saved listings</h2><span className="text-xs text-muted-foreground">{savedListings.length} available</span></div>
              {savedListings.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Save a property while browsing and it will appear here.</p> : <ul className="mt-3 divide-y divide-border">{savedListings.map((listing) => <li key={listing.id} className="py-3"><Link to="/listings/$id" params={{ id: listing.id }} className="font-medium text-primary hover:underline">{listing.title}</Link><p className="text-xs text-muted-foreground">{formatNaira(listing.price)} · {listing.city}, {listing.state}</p></li>)}</ul>}
            </section>}

            {!isBusiness && <section className="rounded-xl bg-card p-6 shadow-card">
              <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="text-lg font-bold">New listings today</h2><span className="text-xs text-muted-foreground">{newListingsToday.length} available</span></div>
              {newListingsToday.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No new approved listings today. <Link to="/listings" className="text-primary underline">Browse all properties</Link>.</p> : <ul className="mt-3 divide-y divide-border">{newListingsToday.map((listing) => <li key={listing.id} className="py-3"><Link to="/listings/$id" params={{ id: listing.id }} className="font-medium text-primary hover:underline">{listing.title}</Link><p className="text-xs text-muted-foreground">{formatNaira(listing.price)} · {listing.city}, {listing.state}</p></li>)}</ul>}
            </section>}

            <section className="rounded-xl bg-card p-6 shadow-card">
              <h2 className="text-lg font-bold">Viewings I've requested</h2>
              {mine.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">None yet. <Link to="/listings" className="text-primary">Browse properties</Link>.</p> : (
                <ul className="mt-3 divide-y divide-border">
                  {mine.map((v) => (
                    <li key={v.id} className="py-3 text-sm">
                      <div className="flex justify-between gap-2"><span className="font-medium">{v.listings?.title}</span><span className="rounded bg-muted px-2 py-0.5 text-xs capitalize">{v.status}</span></div>
                      <div className="text-muted-foreground">{fmt(v.requested_at)}</div>
                      {v.viewing_code && <div className="mt-1 font-semibold text-primary">Viewing Code: {v.viewing_code}</div>}
                      {v.status === "accepted" && <div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs text-primary">Landlord accepted your request.</span><Link to="/listings/$id" params={{ id: v.listing_id }} className="text-xs font-medium text-primary underline">Chat directly with landlord</Link></div>}
                      {v.status === "met" && <div className="mt-2 flex flex-wrap items-center gap-3"><span className="text-xs text-muted-foreground">{v.tenant_completed_at ? "You marked this completed." : "Both people must mark the viewing completed."}</span>{!v.tenant_completed_at && <button onClick={() => updateViewing(v.id, "complete")} className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground">Viewing Completed</button>}<Link to="/listings/$id" params={{ id: v.listing_id }} className="text-xs font-medium text-primary underline">Chat directly with landlord</Link></div>}
                      {v.status === "completed" && <p className="mt-2 text-xs font-medium text-primary">Viewing completed by both people.</p>}
                      {ratingForm(v)}
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
            {isBusiness ? (
              <section className="rounded-xl bg-card p-6 shadow-card">
                <h2 className="font-bold">Landlord Premium</h2>
                {landlordPremium ? <><p className="mt-2 text-sm text-primary">Verified Premium Landlord benefits are active through {landlordPlanRecord?.ends_at ? new Date(landlordPlanRecord.ends_at).toLocaleDateString("en-NG") : "your current plan period"}.</p>{landlordPlanRecord?.cancel_at_period_end ? <p className="mt-2 text-xs text-muted-foreground">Auto-renewal is cancelled.</p> : <button onClick={() => void cancelRenewal("landlord_premium")} className="mt-3 text-xs text-muted-foreground underline">Cancel auto-renewal</button>}</> : <><p className="mt-2 text-sm text-muted-foreground">₦5,000/month · Up to 5 properties, unlimited viewing requests, first in search, and see property viewers.</p><Button className="mt-3 w-full" onClick={() => void startPaidPlan("landlord_premium")}>Upgrade to Premium</Button></>}
                {!landlordPremium && <p className="mt-2 text-xs text-muted-foreground">Free plan: 1 active property and 5 viewing requests per month.</p>}
              </section>
            ) : (
              <section className="rounded-xl bg-card p-6 shadow-card">
                <h2 className="font-bold">Tenant Premium</h2>
                {tenantPremium ? <>
                  <p className="mt-2 text-sm text-primary">Premium Active ✅ — 24h early access + alerts</p>
                  <p className="mt-1 text-xs text-muted-foreground">Active through {tenantPlanRecord?.current_period_end ? new Date(tenantPlanRecord.current_period_end).toLocaleDateString("en-NG") : "your current plan period"}.</p>
                  {tenantPlanRecord?.cancel_at_period_end ? <p className="mt-2 text-xs text-muted-foreground">Auto-renewal is cancelled.</p> : <button onClick={() => void cancelRenewal("tenant_premium")} className="mt-3 text-xs text-muted-foreground underline">Cancel</button>}
                  <form className="mt-4 space-y-3 border-t border-border pt-4" onSubmit={(event) => void saveTenantAlerts(event)}>
                    <h3 className="text-sm font-semibold">Area and budget alerts</h3>
                    <label className="block text-xs text-muted-foreground">Areas, separated by commas<input className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" placeholder="Lekki, Yaba, Surulere" value={alertAreas} onChange={(event) => setAlertAreas(event.target.value)} /></label>
                    <div className="grid grid-cols-2 gap-3">
                      <label className="block text-xs text-muted-foreground">Minimum budget (₦)<input type="number" min="0" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" value={alertMinBudget} onChange={(event) => setAlertMinBudget(event.target.value)} /></label>
                      <label className="block text-xs text-muted-foreground">Maximum budget (₦)<input type="number" min="0" className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground" value={alertMaxBudget} onChange={(event) => setAlertMaxBudget(event.target.value)} /></label>
                    </div>
                    <Button type="submit" variant="outline" className="w-full">Save alerts</Button>
                  </form>
                  <div className="mt-4 border-t border-border pt-4">
                    <h3 className="text-sm font-semibold">Matching new properties</h3>
                    {tenantAlerts.length === 0 ? <p className="mt-2 text-xs text-muted-foreground">No matching properties yet.</p> : <ul className="mt-2 space-y-2">{tenantAlerts.map((alert) => <li key={alert.id} className="text-sm">
                      {alert.listing ? <Link to="/listings/$id" params={{ id: alert.listing.id }} className="font-medium text-primary underline">{alert.listing.title}</Link> : <span className="text-muted-foreground">Property unavailable</span>}
                      {alert.listing && <div className="text-xs text-muted-foreground">{alert.listing.city}, {alert.listing.state} · {formatNaira(alert.listing.price)}</div>}
                      {!alert.seen_at && <button className="mt-1 text-xs text-muted-foreground underline" onClick={() => { void supabase.from("tenant_alert_matches").update({ seen_at: new Date().toISOString() }).eq("id", alert.id).then(({ error }) => { if (error) toast.error(error.message); else void qc.invalidateQueries({ queryKey: ["tenant-alert-matches", user.id] }); }); }}>Mark seen</button>}
                    </li>)}</ul>}
                  </div>
                </> : <><p className="mt-2 text-sm text-muted-foreground">₦2,000/month · See new approved properties 24 hours early and get area and budget alerts.</p><Button className="mt-3 w-full" onClick={() => void startTenantPremiumCheckout()}>Get Tenant Premium — ₦2,000/month</Button></>}
              </section>
            )}
            {isBusiness && landlordPremium && <section className="rounded-xl bg-card p-6 shadow-card"><h2 className="font-bold">Property viewers</h2>{listingViewers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">No signed-in tenants have viewed your properties yet.</p> : <ul className="mt-3 space-y-2">{listingViewers.slice(0, 20).map((viewer, index) => <li key={`${viewer.listing_id}:${viewer.viewer_id}:${index}`} className="text-sm"><span className="font-medium">{viewer.viewer_name ?? "RentReady tenant"}</span><span className="text-muted-foreground"> · {new Date(viewer.viewed_at).toLocaleDateString("en-NG")}</span></li>)}</ul>}</section>}
          </aside>
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
