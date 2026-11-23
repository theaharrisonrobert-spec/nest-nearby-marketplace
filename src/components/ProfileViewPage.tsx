import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import type { ChangeEvent } from "react";
import { CalendarDays, Camera, Home, LayoutDashboard, MessageSquare, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

const cardClass = "rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7";

export function ProfileViewPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const photoInput = useRef<HTMLInputElement>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const { data: profile, isLoading } = useQuery({
    queryKey: ["profile-view", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("full_name, phone, avatar_url, account_type, professional_type, verification_status, id_document_path")
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
  async function uploadPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Choose a JPEG, PNG, or WebP photo.");
      input.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPhotoError("Choose a photo under 5 MB.");
      input.value = "";
      return;
    }

    setPhotoUploading(true);
    setPhotoError("");
    let uploadedPath: string | null = null;
    let profileUpdated = false;
    try {
      const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      uploadedPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: storageError } = await supabase.storage.from("profile-photos")
        .upload(uploadedPath, file, { contentType: file.type, upsert: false });
      if (storageError) throw storageError;
      const { data: signed, error: signedError } = await supabase.storage.from("profile-photos").createSignedUrl(uploadedPath, 60 * 60);
      if (signedError) throw signedError;
      const { data: updated, error: updateError } = await supabase.from("profiles").update({ avatar_url: uploadedPath })
        .eq("id", user.id).select("avatar_url").maybeSingle();
      if (updateError) throw updateError;
      if (!updated) throw new Error("Your profile could not be updated. Please try again.");
      profileUpdated = true;
      setPhotoUrl(signed.signedUrl);
      qc.setQueryData(["profile-view", user.id], (current: typeof profile) => current ? { ...current, avatar_url: uploadedPath } : current);
      await qc.invalidateQueries({ queryKey: ["profile-header", user.id] });
    } catch (error) {
      if (uploadedPath && !profileUpdated) void supabase.storage.from("profile-photos").remove([uploadedPath]);
      setPhotoError(error instanceof Error ? error.message : "Could not upload your photo. Please try again.");
    } finally {
      setPhotoUploading(false);
      input.value = "";
    }
  }
  const accountTypeLabel = profile?.account_type === "landlord" ? profile.professional_type === "agent_realtor" ? "Agent" : "Landlord" : "Tenant";
  const role = isAdmin ? `Admin • ${accountTypeLabel}` : accountTypeLabel;
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
      <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Your account</p><h1 className="mt-2 text-3xl font-bold">Profile</h1><p className="mt-2 text-muted-foreground">Your RentReady account details.</p>
        <div className="mt-4">{isAdmin || profile?.account_type === "landlord" ? <Button asChild className="h-12 bg-primary font-semibold text-white hover:bg-primary/90"><Link to="/post">+ Post Property</Link></Button> : <Button asChild className="h-12 bg-primary font-semibold text-white hover:bg-primary/90"><Link to="/settings" hash="account-type">Become a Landlord to Post</Link></Button>}</div>
      </div>
      <section className={cardClass} aria-label="Profile details">
        {isLoading ? <p className="text-muted-foreground">Loading your profile…</p> : <>
          <div className="flex flex-wrap items-center gap-5">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-primary sm:h-36 sm:w-36">
              {photoUrl ? <img src={photoUrl} alt={`${firstName || "Profile"} profile photo`} className="h-full w-full object-cover" /> : <span className="text-5xl font-bold">{firstName.charAt(0).toUpperCase() || "?"}</span>}
            </div>
            <div className="min-w-0"><h2 className="text-2xl font-bold">Hi, {firstName || "there"}</h2><span className="mt-2 inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">{role}</span>
              <div className="mt-4"><Button type="button" disabled={photoUploading} onClick={() => photoInput.current?.click()} className="h-11 bg-primary font-semibold text-white hover:bg-primary/90"><Camera className="mr-2 h-4 w-4" />{photoUploading ? "Uploading photo…" : "Edit / Change Photo"}</Button>
                <input ref={photoInput} type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event)} className="sr-only" aria-label="Choose profile photo" />
                {photoError && <p role="alert" className="mt-2 max-w-sm text-sm text-destructive">{photoError}</p>}
              </div>
            </div>
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
      <section className={cardClass} aria-label="Account links">
        <h2 className="text-lg font-bold">Your RentReady</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Link to="/dashboard" className="flex items-center gap-3 rounded-xl border border-border p-4 font-semibold hover:border-primary"><LayoutDashboard className="h-5 w-5 text-primary" />Dashboard</Link>
          <Link to="/dashboard" hash="viewings" className="flex items-center gap-3 rounded-xl border border-border p-4 font-semibold hover:border-primary"><CalendarDays className="h-5 w-5 text-primary" />Tours</Link>
          <Link to="/messages" className="flex items-center gap-3 rounded-xl border border-border p-4 font-semibold hover:border-primary"><MessageSquare className="h-5 w-5 text-primary" />Inbox</Link>
          <Link to="/verify" className="flex items-center gap-3 rounded-xl border border-border p-4 font-semibold hover:border-primary"><ShieldCheck className="h-5 w-5 text-primary" />Verification</Link>
          {isAdmin && <Link to="/admin" className="flex items-center gap-3 rounded-xl border border-border p-4 font-semibold hover:border-primary"><ShieldCheck className="h-5 w-5 text-primary" />Admin</Link>}
        </div>
      </section>
    </main>
    <SiteFooter />
  </div>;
}
