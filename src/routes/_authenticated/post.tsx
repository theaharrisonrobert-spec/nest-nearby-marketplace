import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AMENITIES, APARTMENT_SUBTYPES, CATEGORIES, STATES } from "@/lib/listings";
import { canPublish } from "@/lib/marketplace-rules";

export const Route = createFileRoute("/_authenticated/post")({
  head: () => ({
    meta: [
      { title: "Post a Property — RentReady" },
      { name: "description", content: "List your property for rent or sale at your own price." },
      { property: "og:title", content: "Post a Property — RentReady" },
      { property: "og:description", content: "List your property at your own price." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PostPage,
});

function PostPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null; verification_status: string; account_type: string } | null>(null);
  useEffect(() => {
    let active = true;
    void Promise.all([
      supabase.from("profiles").select("full_name, phone, verification_status, account_type").eq("id", user.id).maybeSingle(),
      supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
    ]).then(([profileResult, adminResult]) => {
      if (!active) return;
      if (profileResult.error || adminResult.error) {
        toast.error("Could not load your posting permissions. Please try again.");
        return;
      }
      setProfile(profileResult.data);
      setIsAdmin(!!adminResult.data);
    }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [user.id]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canPublish(profile?.account_type, profile?.verification_status, isAdmin)) { toast.error("An approved landlord account is required to post"); return; }
    const f = new FormData(e.currentTarget);
    const price = Number(String(f.get("price")).replace(/,/g, ""));
    if (!price || price <= 0) { toast.error("Enter your price in Naira"); return; }
    setBusy(true);
    let image_url: string | null = null;
    const file = f.get("image") as File;
    if (file && file.size) {
      const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "")}`;
      const up = await supabase.storage.from("listing-images").upload(path, file);
      if (up.error) { setBusy(false); toast.error("Photo upload failed"); return; }
      const signed = await supabase.storage.from("listing-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 5);
      image_url = signed.data?.signedUrl ?? null;
    }
    const num = (k: string) => (f.get(k) ? Number(f.get(k)) : null);
    const purpose = String(f.get("purpose"));
    const { data, error } = await supabase.from("listings").insert({
      owner_id: user.id,
      title: String(f.get("title")),
      description: String(f.get("description") || ""),
      category: String(f.get("category")),
      property_subtype: String(f.get("property_subtype") || "") || null,
      purpose,
      price,
      price_period: purpose === "sale" ? "once" : String(f.get("period")),
      negotiable: f.get("negotiable") === "on",
      state: String(f.get("state")),
      city: String(f.get("city")),
      address: String(f.get("address") || ""),
      bedrooms: num("bedrooms"),
      bathrooms: num("bathrooms"),
      size_sqft: num("size"),
      contact_name: String(f.get("contact_name")),
      contact_phone: String(f.get("contact_phone")),
      image_url,
      landmarks: String(f.get("landmarks") || "").slice(0, 500) || null,
      amenities: f.getAll("amenities").map(String).filter((a) => AMENITIES.includes(a)),
      show_address: f.get("show_address") === "on",
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Submitted! Your property goes live once our team approves it.");
    navigate({ to: "/" });
    void data;
  }

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-sm font-medium";
  const [purpose, setPurpose] = useState("rent");
  const [category, setCategory] = useState<string>(CATEGORIES[0].name);

  if (profileLoading) return <div className="min-h-screen bg-background"><SiteHeader /><p className="mx-auto max-w-xl px-5 py-16 text-muted-foreground">Loading your account…</p></div>;
  if (!profile) return <div className="min-h-screen bg-background"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">Account unavailable</h1><p className="mt-3 text-muted-foreground">We couldn’t load your profile. Please refresh and try again.</p></div><SiteFooter /></div>;
  if (profile.account_type !== "landlord" && !isAdmin) return <div className="min-h-screen bg-background"><SiteHeader /><div className="mx-auto max-w-xl px-5 py-16"><h1 className="text-3xl font-bold">Landlord account required</h1><p className="mt-3 text-muted-foreground">Choose Landlord or Agent from your profile account type to post a property. You can still search, save, and message as a Tenant.</p><Link to="/settings" hash="account-type" className="mt-5 inline-block rounded-lg bg-primary px-5 py-3 font-semibold text-white">Change Account Type</Link><Link to="/listings" className="ml-3 mt-5 inline-block text-primary">Browse properties</Link></div><SiteFooter /></div>;
  if (profile.verification_status !== "approved" && !isAdmin) {
    const pending = profile.verification_status === "pending";
    return (
      <div className="min-h-screen bg-muted/40">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <h1 className="text-3xl font-bold">{pending ? "Verification under review" : "Verification required"}</h1>
          <p className="mt-3 text-muted-foreground">
            {pending
              ? "Your ID documents are being reviewed. You'll be able to post as soon as you're approved."
              : "Before you can post a property, submit a valid ID (international passport, NIN, or driver's license) for approval."}
          </p>
          {!pending && (
            <Link to="/verify" className="mt-6 inline-block rounded-lg bg-primary px-6 py-3 font-medium text-primary-foreground">Get Verified</Link>
          )}
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-3xl font-bold">Post a Property</h1>
        <p className="mt-1 text-muted-foreground">You set the price. Posting is free. No agent or agreement fee — tenants connect directly with you. Every listing is reviewed before it goes live, and your phone number is not shown publicly.</p>
        <span className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">✅ No Agent Fee — Direct to Landlord</span>
        <form key={profile ? "p" : "n"} onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-xl bg-card p-6 shadow-card sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={label}>Title</label><input name="title" required placeholder="e.g. 2 Bedroom Flat in Yaba" className={input} /></div>
          <div><label className={label}>Property type</label>
            <select name="category" value={category} onChange={(event) => setCategory(event.target.value)} className={input}>{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
          {category === "Apartment" && <div><label className={label}>Apartment type</label><select name="property_subtype" className={input}>{APARTMENT_SUBTYPES.map((subtype) => <option key={subtype}>{subtype}</option>)}</select></div>}
          <div><label className={label}>Rent or sale</label>
            <select name="purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={input}><option value="rent">For Rent</option><option value="sale">For Sale</option></select></div>
          <div><label className={label}>Your price (₦)</label><input name="price" required inputMode="numeric" placeholder="e.g. 1500000" className={input} /></div>
          {purpose === "rent" ? (
            <div><label className={label}>Price per</label>
              <select name="period" className={input}><option value="year">Year</option><option value="month">Month</option><option value="week">Week</option><option value="day">Day</option></select></div>
          ) : <div />}
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="negotiable" /> Price is negotiable</label>
          <div><label className={label}>State</label>
            <select name="state" defaultValue="Lagos" className={input}>{STATES.map((s) => <option key={s}>{s}</option>)}</select></div>
          <div><label className={label}>City / Area</label><input name="city" required placeholder="e.g. Lekki, Ikeja, Wuse" className={input} /></div>
          <div className="sm:col-span-2"><label className={label}>Street address (optional)</label><input name="address" className={input} /></div>
          <div><label className={label}>Bedrooms</label><input name="bedrooms" type="number" min={0} className={input} /></div>
          <div><label className={label}>Bathrooms</label><input name="bathrooms" type="number" min={0} className={input} /></div>
          <div><label className={label}>Size (sqft)</label><input name="size" type="number" min={0} className={input} /></div>
          <div><label className={label}>Photo</label><input name="image" type="file" accept="image/*" className="text-sm" /></div>
          <label className="flex items-center gap-2 text-sm sm:col-span-2"><input type="checkbox" name="show_address" /> Show the street address publicly (otherwise only the area is shown)</label>
          <div className="sm:col-span-2"><label className={label}>Amenities</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">{AMENITIES.map((a) => <label key={a} className="flex items-center gap-2 text-sm"><input type="checkbox" name="amenities" value={a} />{a}</label>)}</div></div>
          <div className="sm:col-span-2"><label className={label}>Nearby landmarks (comma separated)</label><input name="landmarks" maxLength={500} placeholder="e.g. Lekki Toll Gate, Novare Mall" className={input} /></div>
          <div className="sm:col-span-2"><label className={label}>Description</label><textarea name="description" rows={4} placeholder="Power, water, security, parking, nearby landmarks…" className={input} /></div>
          <div><label className={label}>Contact name</label><input name="contact_name" required defaultValue={profile?.full_name ?? ""} className={input} /></div>
          <div><label className={label}>Phone / WhatsApp</label><input name="contact_phone" required defaultValue={profile?.phone ?? ""} placeholder="0803…" className={input} /></div>
          <button disabled={busy} className="rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60 sm:col-span-2">{busy ? "Posting…" : "Post Property"}</button>
        </form>
      </div>
      <SiteFooter />
    </div>
  );
}
