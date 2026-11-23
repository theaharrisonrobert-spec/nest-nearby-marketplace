import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { CalendarDays, Home, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

const cardClass = "rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7";

export function ProfileViewPage({ user }: { user: User }) {
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-view", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("full_name, phone, avatar_url, account_type, verification_status, id_document_path")
        .eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ["profile-view-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data;
    },
  });
  const { data: listingCount = 0 } = useQuery({
    queryKey: ["profile-view-listings", user.id],
    queryFn: async () => {
      const { count, error } = await supabase.from("listings").select("id", { count: "exact", head: true }).eq("owner_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: bookingCount = 0 } = useQuery({
    queryKey: ["profile-view-bookings", user.id],
    queryFn: async () => {
      const { count, error } = await supabase.from("viewings").select("id", { count: "exact", head: true }).eq("requester_id", user.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_url) { setPhotoUrl(null); return; }
    void supabase.storage.from("profile-photos").createSignedUrl(profile.avatar_url, 60 * 60)
      .then(({ data, error }) => { if (active && !error) setPhotoUrl(data.signedUrl); });
    return () => { active = false; };
  }, [profile?.avatar_url]);

  const [firstName = "", ...restName] = (profile?.full_name ?? "").trim().split(/\s+/).filter(Boolean);
  const lastName = restName.join(" ");
  const role = isAdmin ? "Admin" : profile?.account_type === "landlord" ? "Landlord" : "Tenant";
  const verificationStatus = profile?.verification_status === "approved"
    ? "Verified"
    : profile?.verification_status === "pending"
      ? "Pending Review"
      : profile?.verification_status === "rejected"
        ? "Rejected"
        : profile?.verification_status === "unverified"
          ? "Awaiting ID Upload"
          : "Not Started";

  return <div className="min-h-screen bg-background text-foreground">
    <SiteHeader />
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 sm:px-5 sm:py-12">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Your account</p><h1 className="mt-2 text-3xl font-bold">Profile</h1><p className="mt-2 text-muted-foreground">Your RentReady account details.</p></div>
      <section className={cardClass} aria-label="Profile details">
        {isLoading ? <p className="text-muted-foreground">Loading your profile…</p> : <>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-primary">
              {photoUrl ? <img src={photoUrl} alt="Profile" className="h-full w-full object-cover" /> : <UserRound className="h-10 w-10" />}
            </div>
            <div><h2 className="text-2xl font-bold">{[firstName, lastName].filter(Boolean).join(" ") || "Name not added"}</h2><span className="mt-2 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">{role}</span></div>
          </div>
          <dl className="mt-7 grid gap-4 border-t border-border pt-5 sm:grid-cols-2">
            <div><dt className="text-sm text-muted-foreground">First Name</dt><dd className="mt-1 font-semibold">{firstName || "—"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Last Name</dt><dd className="mt-1 font-semibold">{lastName || "—"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Phone</dt><dd className="mt-1 font-semibold">{profile?.phone || "—"}</dd></div>
            <div><dt className="text-sm text-muted-foreground">Email</dt><dd className="mt-1 break-all font-semibold">{user.email || "—"}</dd></div>
            {profile?.account_type === "landlord" && <div><dt className="text-sm text-muted-foreground">Verification status</dt><dd className="mt-1 font-semibold">{verificationStatus}</dd></div>}
          </dl>
          <Button asChild className="mt-7 h-12 w-full bg-primary font-semibold text-white hover:bg-primary/90"><Link to="/settings">Edit Profile</Link></Button>
        </>}
      </section>
      <section className="grid gap-4 sm:grid-cols-2" aria-label="Account activity">
        <Link to="/my-listings" className={`${cardClass} flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg`}><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-primary"><Home className="h-6 w-6" /></span><span><span className="block text-sm text-muted-foreground">My Listings</span><strong className="text-2xl">{listingCount}</strong></span></Link>
        <Link to="/dashboard" className={`${cardClass} flex items-center gap-4 transition hover:-translate-y-0.5 hover:shadow-lg`}><span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-primary"><CalendarDays className="h-6 w-6" /></span><span><span className="block text-sm text-muted-foreground">My Bookings</span><strong className="text-2xl">{bookingCount}</strong></span></Link>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
