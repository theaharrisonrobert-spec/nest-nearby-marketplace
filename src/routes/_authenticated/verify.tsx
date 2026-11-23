import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { startPaidPlan } from "@/lib/payments";
import { MAX_VERIFICATION_FILE_SIZE, validateLandlordVerification } from "@/lib/landlord-verification";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({
    meta: [
      { title: "Verify your identity — RentReady" },
      { name: "description", content: "Submit a valid ID to get verified and start posting properties on RentReady." },
      { property: "og:title", content: "Verify your identity — RentReady" },
      { property: "og:description", content: "Submit a valid ID to get verified and start posting properties." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyPage,
});

type Profile = {
  full_name: string | null;
  account_type: string;
  verification_status: string;
  id_type: string | null;
  verification_fee_paid: boolean;
  phone: string | null;
  phone_verified_at: string | null;
};

const ID_TYPES = ["National ID (NIN)"];

function VerifyPage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("full_name, account_type, verification_status, id_type, verification_fee_paid, phone, phone_verified_at").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user.id]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    if (!profile?.verification_fee_paid) { toast.error("Pay the one-time ₦1,500 NIN verification fee before submitting your NIN"); return; }
    const nin = String(f.get("id_number") ?? "").replace(/\D/g, "");
    if (!/^\d{11}$/.test(nin)) { toast.error("Enter a valid 11-digit NIN"); return; }
    const documentValue = f.get("document");
    const selfieValue = f.get("selfie");
    const idFile = documentValue instanceof File ? documentValue : null;
    const selfieFile = selfieValue instanceof File ? selfieValue : null;
    const validationError = validateLandlordVerification({
      accountType: profile?.account_type,
      verificationFeePaid: !!profile?.verification_fee_paid,
      phoneVerified: !!profile?.phone_verified_at,
      registeredName: profile?.full_name,
      nameMatchConfirmed: f.get("name_matches") === "on",
      idFile,
      selfieFile,
    });
    if (validationError) { toast.error(validationError); return; }
    if (!idFile || !selfieFile) return;

    setBusy(true);
    try {
      const submissionId = crypto.randomUUID();
      const safeName = (file: File) => file.name.replace(/[^\w.-]/g, "_").slice(-120) || "upload";
      const idPath = `${user.id}/${submissionId}/id-${safeName(idFile)}`;
      const selfiePath = `${user.id}/${submissionId}/selfie-${safeName(selfieFile)}`;
      const idUpload = await supabase.storage.from("id-documents").upload(idPath, idFile, { contentType: idFile.type, upsert: false });
      if (idUpload.error) { toast.error("ID upload failed — check the file and try again"); return; }
      const selfieUpload = await supabase.storage.from("id-documents").upload(selfiePath, selfieFile, { contentType: selfieFile.type, upsert: false });
      if (selfieUpload.error) { toast.error("Selfie upload failed — check the file and try again"); return; }
      const { error } = await supabase.from("profiles").update({
        id_type: String(f.get("id_type")),
        id_number: nin,
        id_document_path: idPath,
        selfie_document_path: selfiePath,
        verification_status: "pending",
      }).eq("id", user.id);
      if (error) { toast.error(error.message); return; }
      toast.success("ID and selfie submitted for review");
      setProfile((p) => p && { ...p, verification_status: "pending" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document submission failed — try again");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-sm font-medium";
  const status = profile?.verification_status;

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-5 py-12">
        <h1 className="text-3xl font-bold">Identity Verification</h1>
        <p className="mt-2 text-muted-foreground">To keep RentReady safe and agent-free, every owner submits a valid ID. Once approved, you can post properties at your own price.</p>

        {status === "approved" ? (
          <div className="mt-8 rounded-xl bg-card p-8 text-center shadow-card">
            <ShieldCheck className="mx-auto h-12 w-12 text-brand" />
            <h2 className="mt-3 text-xl font-bold">You're verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your identity has been approved. You can post and manage properties.</p>
          </div>
        ) : status === "pending" ? (
          <div className="mt-8 rounded-xl bg-card p-8 text-center shadow-card">
            <Clock className="mx-auto h-12 w-12 text-brand" />
            <h2 className="mt-3 text-xl font-bold">Under review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your documents are being reviewed. You'll be able to post as soon as you're approved.</p>
          </div>
        ) : profile && profile.account_type !== "landlord" ? (
          <div className="mt-8 rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">Landlord identity verification is available only to landlord accounts.</div>
        ) : (
          <div className="mt-8 space-y-5">
          {!profile?.phone_verified_at && <section className="rounded-xl bg-card p-6 shadow-card"><h2 className="font-bold">Verify your phone number</h2><p className="mt-1 text-sm text-muted-foreground">Phone verification is required before we can review your NIN.</p><Link to="/verify-phone" className="mt-3 inline-block text-sm font-semibold text-primary underline">Verify phone by SMS</Link></section>}
          {!profile?.verification_fee_paid && <section className="rounded-xl bg-card p-6 shadow-card"><h2 className="font-bold">One-time NIN verification fee · ₦1,500</h2><p className="mt-1 text-sm text-muted-foreground">This payment does not guarantee approval. RentReady reviews your NIN and phone details before awarding the verification badge.</p><button type="button" onClick={() => void startPaidPlan("nin_verification")} className="mt-4 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground">Pay ₦1,500 NIN verification fee</button></section>}
          <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-card p-6 shadow-card">
            {!profile?.verification_fee_paid && <p className="rounded-lg bg-muted p-3 text-sm text-muted-foreground">Submit your NIN after the verification fee payment is confirmed.</p>}
            {status === "rejected" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                Your previous submission was not approved. Please check your details and submit a clear, valid ID again.
              </div>
            )}
            <div>
              <label className={label}>Phone number</label>
              <p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{profile?.phone ?? "Add and verify your phone number"}{profile?.phone_verified_at ? " · Verified" : " · Not verified"}</p>
            </div>
            <div>
              <label className={label}>ID type</label>
              <select name="id_type" required className={input}>
                {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>ID number</label>
              <input name="id_number" required inputMode="numeric" minLength={11} maxLength={11} placeholder="Enter your 11-digit NIN" className={input} />
            </div>
            <div>
              <label className={label}>Photo or scan of your ID</label>
              <input name="document" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or PDF, up to 10 MB. Only you and the review team can access it.</p>
            </div>
            <div>
              <label className={label}>Selfie holding your ID</label>
              <input name="selfie" type="file" required accept="image/jpeg,image/png,image/webp" className="text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Use a clear selfie where your face and ID are visible. JPG, PNG or WebP, up to 10 MB.</p>
            </div>
            <div className="rounded-lg border border-border bg-muted/40 p-4">
              <p className="text-sm font-medium">Registered name</p>
              <p className="mt-1 text-sm">{profile?.full_name || "Name not set"}</p>
              <label className="mt-3 flex items-start gap-2 text-sm">
                <input name="name_matches" type="checkbox" required className="mt-1" />
                <span>I confirm the name on my ID matches my registered name above. An admin will compare them manually.</span>
              </label>
            </div>
            <button disabled={busy || !profile?.verification_fee_paid || !profile?.phone_verified_at} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "Submitting…" : "Submit ID and selfie for review"}
            </button>
          </form>
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
