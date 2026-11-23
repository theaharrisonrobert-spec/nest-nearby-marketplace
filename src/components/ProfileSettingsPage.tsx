import { useEffect, useMemo, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, ShieldCheck, UserRound } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";

const DEFAULT_NOTIFICATIONS = {
  new_messages: true,
  booking_requests: true,
  payment_alerts: true,
  verification_updates: true,
};
type NotificationKey = keyof typeof DEFAULT_NOTIFICATIONS;

const NOTIFICATIONS: { key: NotificationKey; title: string; detail: string }[] = [
  { key: "new_messages", title: "New messages", detail: "When someone sends you a message." },
  { key: "booking_requests", title: "New booking requests", detail: "When someone requests a viewing." },
  { key: "payment_alerts", title: "Payment alerts", detail: "Updates about your RentReady payments." },
  { key: "verification_updates", title: "Verification updates", detail: "Changes to your identity review." },
];

const fieldClass = "h-12 bg-white text-base";
const cardClass = "rounded-2xl border border-border bg-card p-5 shadow-card sm:p-7";

export function ProfileSettingsPage({ user }: { user: User }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [storedPhotoUrl, setStoredPhotoUrl] = useState<string | null>(null);
  const [profileSaving, setProfileSaving] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [notificationSaving, setNotificationSaving] = useState<NotificationKey | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["settings-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("full_name, phone, phone_verified_at, avatar_url, notification_preferences, account_type, verification_status, id_document_path")
        .eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ["settings-admin", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (!profile) return;
    const parts = (profile.full_name ?? "").trim().split(/\s+/).filter(Boolean);
    setFirstName(parts.shift() ?? "");
    setLastName(parts.join(" "));
    setPhone(profile.phone ?? "");
  }, [profile?.full_name, profile?.phone]);

  useEffect(() => {
    if (!photoFile) { setPhotoPreview(null); return; }
    const previewUrl = URL.createObjectURL(photoFile);
    setPhotoPreview(previewUrl);
    return () => URL.revokeObjectURL(previewUrl);
  }, [photoFile]);

  useEffect(() => {
    let active = true;
    if (!profile?.avatar_url) { setStoredPhotoUrl(null); return; }
    void supabase.storage.from("profile-photos").createSignedUrl(profile.avatar_url, 60 * 60)
      .then(({ data, error }) => { if (active && !error) setStoredPhotoUrl(data.signedUrl); });
    return () => { active = false; };
  }, [profile?.avatar_url]);

  const notifications = useMemo(() => ({ ...DEFAULT_NOTIFICATIONS, ...(profile?.notification_preferences as Partial<typeof DEFAULT_NOTIFICATIONS> | null) }), [profile?.notification_preferences]);
  const role = isAdmin ? "Admin" : profile?.account_type === "landlord" ? "Landlord" : "Tenant";
  const verificationStatus = profile?.verification_status === "approved"
    ? "Verified"
    : profile?.verification_status === "pending"
      ? "Pending Review"
      : profile?.verification_status === "rejected"
        ? "Rejected"
        : profile?.id_document_path
          ? "Pending Review"
        : profile?.verification_status === "unverified"
          ? "Awaiting ID Upload"
          : "Not Started";

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) return;
    const fullName = [firstName.trim(), lastName.trim()].filter(Boolean).join(" ");
    if (!firstName.trim()) { toast.error("Enter your first name before saving."); return; }
    if (profile.phone_verified_at && phone.trim() !== (profile.phone ?? "")) {
      toast.error("Your verified phone number cannot be changed here. Contact Support for help.");
      return;
    }

    setProfileSaving(true);
    try {
      let avatarPath = profile.avatar_url;
      if (photoFile) {
        const extension = photoFile.type === "image/png" ? "png" : photoFile.type === "image/webp" ? "webp" : "jpg";
        const path = `${user.id}/${crypto.randomUUID()}.${extension}`;
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(path, photoFile, { contentType: photoFile.type, upsert: false });
        if (uploadError) throw uploadError;
        avatarPath = path;
      }
      const { error } = await supabase.from("profiles").update({ full_name: fullName, phone: phone.trim() || null, avatar_url: avatarPath }).eq("id", user.id);
      if (error) throw error;
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["settings-profile", user.id] }),
        qc.invalidateQueries({ queryKey: ["home-greeting-profile", user.id] }),
        qc.invalidateQueries({ queryKey: ["account-menu-profile", user.id] }),
        qc.invalidateQueries({ queryKey: ["profile", user.id] }),
      ]);
      setPhotoFile(null);
      toast.success("Profile saved. Your homepage greeting is updated.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function savePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user.email) { toast.error("Your account has no email address to verify."); return; }
    if (newPassword.length < 8) { toast.error("Use at least 8 characters for your new password."); return; }
    if (newPassword !== confirmPassword) { toast.error("The new passwords do not match."); return; }
    setPasswordSaving(true);
    try {
      const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: currentPassword });
      if (verifyError) throw new Error("Your current password is incorrect.");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword(""); setNewPassword(""); setConfirmPassword("");
      toast.success("Password changed.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not change your password.");
    } finally {
      setPasswordSaving(false);
    }
  }

  async function toggleNotification(key: NotificationKey, checked: boolean) {
    if (!profile || notificationSaving) return;
    const next = { ...notifications, [key]: checked };
    setNotificationSaving(key);
    const { error } = await supabase.from("profiles").update({ notification_preferences: next }).eq("id", user.id);
    setNotificationSaving(null);
    if (error) { toast.error("Could not save that notification setting."); return; }
    qc.setQueryData(["settings-profile", user.id], { ...profile, notification_preferences: next });
  }

  async function logOutAllDevices() {
    const { error } = await supabase.auth.signOut();
    if (error) { toast.error(error.message); return; }
    await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }

  async function deleteAccount() {
    if (!window.confirm("Delete your RentReady account permanently? This cannot be undone.")) return;
    setDeleteSaving(true);
    const { error } = await supabase.functions.invoke("delete-account", { body: {} });
    setDeleteSaving(false);
    if (error) { toast.error(error.message || "Could not delete your account. Contact Support for help."); return; }
    await supabase.auth.signOut();
    await qc.clear();
    await navigate({ to: "/", replace: true });
    toast.success("Your RentReady account has been deleted.");
  }

  function onPhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) { toast.error("Choose a JPEG, PNG, or WebP photo."); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Choose a photo under 5 MB."); return; }
    setPhotoFile(file);
  }

  return <div className="min-h-screen bg-background text-foreground">
    <SiteHeader />
    <main className="mx-auto max-w-3xl space-y-6 px-4 py-8 pb-28 sm:px-5 sm:py-12">
      <div><p className="text-sm font-semibold uppercase tracking-widest text-primary">Your account</p><h1 className="mt-2 text-3xl font-bold">Profile & Settings</h1><p className="mt-2 text-muted-foreground">Manage your details, security, and notifications.</p></div>
      {isLoading ? <div className={`${cardClass} text-muted-foreground`}>Loading your profile…</div> : <>
        <section className={cardClass} aria-labelledby="profile-heading">
          <h2 id="profile-heading" className="text-xl font-bold">Profile</h2>
          <div className="mt-5 flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full bg-brand-soft text-primary">
              {photoPreview || storedPhotoUrl ? <img src={photoPreview ?? storedPhotoUrl ?? ""} alt="Profile" className="h-full w-full object-cover" /> : <UserRound className="h-9 w-9" />}
            </div>
            <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border border-border px-4 font-semibold hover:bg-muted">
              <Camera className="h-4 w-4" /> Change photo
              <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhotoChange} className="sr-only" />
            </label>
          </div>
          <form onSubmit={(event) => void saveProfile(event)} className="mt-6 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-medium">First Name<Input autoComplete="given-name" className={fieldClass} value={firstName} onChange={(event) => setFirstName(event.target.value)} required /></label>
            <label className="grid gap-1.5 text-sm font-medium">Last Name<Input autoComplete="family-name" className={fieldClass} value={lastName} onChange={(event) => setLastName(event.target.value)} /></label>
            <label className="grid gap-1.5 text-sm font-medium">Phone<Input type="tel" autoComplete="tel" className={fieldClass} value={phone} onChange={(event) => setPhone(event.target.value)} /><span className="text-xs font-normal text-muted-foreground">{profile?.phone_verified_at ? "Your phone is verified and can’t be changed here." : ""}</span></label>
            <label className="grid gap-1.5 text-sm font-medium">Email<Input type="email" value={user.email ?? ""} disabled className={`${fieldClass} cursor-not-allowed bg-muted text-muted-foreground`} /><span className="text-xs font-normal text-muted-foreground">Email can’t be edited here.</span></label>
            <div className="flex items-center gap-2 sm:col-span-2"><span className="text-sm font-medium">Role</span><span className="rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-primary">{role}</span></div>
            <Button type="submit" disabled={profileSaving} className="h-12 bg-primary font-semibold text-white hover:bg-primary/90 sm:col-span-2">{profileSaving ? "Saving…" : "Save profile"}</Button>
          </form>
        </section>

        <section className={cardClass} aria-labelledby="security-heading">
          <h2 id="security-heading" className="text-xl font-bold">Security</h2>
          <form onSubmit={(event) => void savePassword(event)} className="mt-5 grid gap-4">
            <label className="grid gap-1.5 text-sm font-medium">Current Password<Input type="password" autoComplete="current-password" className={fieldClass} value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <div className="grid gap-4 sm:grid-cols-2"><label className="grid gap-1.5 text-sm font-medium">New Password<Input type="password" autoComplete="new-password" minLength={8} className={fieldClass} value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required /></label><label className="grid gap-1.5 text-sm font-medium">Confirm New Password<Input type="password" autoComplete="new-password" minLength={8} className={fieldClass} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required /></label></div>
            <Button type="submit" disabled={passwordSaving} className="h-12 bg-primary font-semibold text-white hover:bg-primary/90">{passwordSaving ? "Saving…" : "Change password"}</Button>
          </form>
          <Button type="button" variant="outline" onClick={() => void logOutAllDevices()} className="mt-3 h-12 w-full border-primary font-semibold text-primary hover:bg-brand-soft">Log out from all devices</Button>
        </section>

        <section className={cardClass} aria-labelledby="notifications-heading">
          <h2 id="notifications-heading" className="text-xl font-bold">Notifications</h2>
          <div className="mt-3 divide-y divide-border">{NOTIFICATIONS.map(({ key, title, detail }) => <div key={key} className="flex min-h-[76px] items-center justify-between gap-4 py-3"><div><p className="font-semibold">{title}</p><p className="text-sm text-muted-foreground">{detail}</p></div><Switch checked={notifications[key]} disabled={notificationSaving !== null} onCheckedChange={(checked) => void toggleNotification(key, checked)} aria-label={`${title} notifications`} /></div>)}</div>
        </section>

        {profile?.account_type === "landlord" && <section className={cardClass} aria-labelledby="verification-heading">
          <h2 id="verification-heading" className="text-xl font-bold">Landlord verification</h2>
          <p className="mt-3 flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-primary" />Verification status: <strong>{verificationStatus}</strong></p>
          <Button asChild className="mt-5 h-12 bg-primary font-semibold text-white hover:bg-primary/90"><Link to="/verify">{profile.id_document_path ? "Go to Verification" : "Upload ID"}</Link></Button>
        </section>}

        <section className={`${cardClass} border-destructive/30`} aria-labelledby="danger-heading">
          <h2 id="danger-heading" className="text-xl font-bold text-destructive">Danger zone</h2>
          <p className="mt-2 text-sm text-muted-foreground">Deleting your account permanently removes your RentReady profile.</p>
          <Button type="button" variant="destructive" disabled={deleteSaving} onClick={() => void deleteAccount()} className="mt-4 h-12">{deleteSaving ? "Deleting…" : "Delete account"}</Button>
        </section>
      </>}
    </main>
    <SiteFooter />
  </div>;
}
