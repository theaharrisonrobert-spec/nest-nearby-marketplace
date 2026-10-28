import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { CATEGORIES, STATES } from "@/lib/listings";

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
  const [profile, setProfile] = useState<{ full_name: string | null; phone: string | null } | null>(null);
  useEffect(() => {
    supabase.from("profiles").select("full_name, phone").eq("id", user.id).maybeSingle().then(({ data }) => setProfile(data));
  }, [user.id]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
    }).select("id").single();
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Your property is live!");
    navigate({ to: "/listings/$id", params: { id: data.id } });
  }

  const input = "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-sm font-medium";
  const [purpose, setPurpose] = useState("rent");

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-8">
        <h1 className="text-3xl font-bold">Post a Property</h1>
        <p className="mt-1 text-muted-foreground">You set the price. Renters and buyers contact you directly — no agent.</p>
        <form key={profile ? "p" : "n"} onSubmit={onSubmit} className="mt-6 grid gap-4 rounded-xl bg-card p-6 shadow-card sm:grid-cols-2">
          <div className="sm:col-span-2"><label className={label}>Title</label><input name="title" required placeholder="e.g. 2 Bedroom Flat in Yaba" className={input} /></div>
          <div><label className={label}>Property type</label>
            <select name="category" className={input}>{CATEGORIES.map((c) => <option key={c.name}>{c.name}</option>)}</select></div>
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
