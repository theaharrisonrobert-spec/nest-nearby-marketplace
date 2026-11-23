import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle, UploadCloud } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { startPaidPlan } from "@/lib/payments";
import { validateVerificationUploads } from "@/lib/landlord-verification";

export const Route = createFileRoute("/_authenticated/verify")({
  head: () => ({
    meta: [
      { title: "Verify your identity — RentReady" },
      { name: "description", content: "Submit your NIN, ID and selfie for RentReady identity review." },
      { property: "og:title", content: "Verify your identity — RentReady" },
      { property: "og:description", content: "Submit your NIN, ID and selfie for identity review." },
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
  id_number: string | null;
  id_document_path: string | null;
  selfie_document_path: string | null;
  verification_fee_paid: boolean;
  phone: string | null;
};

const ID_TYPES = ["National ID (NIN)", "Driver's License", "International Passport", "Voter's Card (PVC)", "National Identity Card"] as const;
const ID_NUMBER_FIELDS: Record<string, { label: string; placeholder: string; numeric?: boolean }> = {
  "National ID (NIN)": { label: "NIN", placeholder: "Enter your 11-digit NIN", numeric: true },
  "Driver's License": { label: "Driver's License Number", placeholder: "Enter your Driver's License Number" },
  "International Passport": { label: "Passport Number", placeholder: "Enter your Passport Number" },
  "Voter's Card (PVC)": { label: "Voter's Card Number / VIN", placeholder: "Enter your Voter's Card Number" },
  "National Identity Card": { label: "ID Card Number", placeholder: "Enter your ID Card Number" },
};

function VerifyPage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"upload" | "summary">("upload");
  const [selectedIdType, setSelectedIdType] = useState<string>(ID_TYPES[0]);
  const [paymentChecking, setPaymentChecking] = useState(false);

  const refreshProfile = useCallback(async (silent = false) => {
    const { data, error } = await supabase.from("profiles")
      .select("full_name, account_type, verification_status, id_type, id_number, id_document_path, selfie_document_path, verification_fee_paid, phone")
      .eq("id", user.id).maybeSingle();
    if (error) { if (!silent) toast.error("Could not load your verification details"); return false; }
    if (data) {
      setProfile(data);
      setStep(data.id_number && data.id_document_path && data.selfie_document_path ? "summary" : "upload");
    }
    return !!data?.verification_fee_paid;
  }, [user.id]);

  useEffect(() => { void refreshProfile(); }, [refreshProfile]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("payment")) return;
    setPaymentChecking(true);
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void refreshProfile(true).then((paid) => {
        if (paid || attempts >= 40) {
          window.clearInterval(timer);
          setPaymentChecking(false);
          if (!paid) toast.error("Payment confirmation has not arrived yet. If you completed checkout, refresh in a moment or contact support.");
        }
      });
    }, 1500);
    return () => window.clearInterval(timer);
  }, [refreshProfile]);

  async function uploadForSummary(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile) { toast.error("Your profile is still loading. Try again in a moment."); return; }
    const form = new FormData(event.currentTarget);
    const idType = String(form.get("id_type") ?? ID_TYPES[0]);
    const rawIdNumber = String(form.get("id_number") ?? "").trim();
    const idNumber = idType === "National ID (NIN)" ? rawIdNumber.replace(/\D/g, "") : rawIdNumber;
    const idValue = form.get("document");
    const selfieValue = form.get("selfie");
    const idFile = idValue instanceof File ? idValue : null;
    const selfieFile = selfieValue instanceof File ? selfieValue : null;
    const validationError = validateVerificationUploads({ accountType: profile.account_type, registeredName: profile.full_name, idType, idNumber, idFile, selfieFile });
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
        id_type: idType,
        id_number: idNumber,
        id_document_path: idPath,
        selfie_document_path: selfiePath,
      }).eq("id", user.id);
      if (error) { toast.error(error.message); return; }
      setProfile((current) => current && { ...current, id_type: idType, id_number: idNumber, id_document_path: idPath, selfie_document_path: selfiePath });
      setStep("summary");
      toast.success("Uploads complete. Review your summary below.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Document upload failed — try again");
    } finally {
      setBusy(false);
    }
  }

  async function submitForReview() {
    if (!profile?.id_number || !profile.id_document_path || !profile.selfie_document_path) {
      toast.error("Upload your NIN, ID and selfie before submitting for review.");
      setStep("upload");
      return;
    }
    if (profile.account_type === "landlord" && !profile.verification_fee_paid) {
      toast.error("Pay the RentReady Verification Fee before submitting for review.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("profiles").update({ verification_status: "pending" }).eq("id", user.id);
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setProfile((current) => current && { ...current, verification_status: "pending" });
    toast.success("Submitted for review");
  }

  const input = "w-full rounded-lg border border-border bg-background px-4 py-3 text-sm outline-none focus:border-primary";
  const label = "mb-1 block text-sm font-medium";
  const status = profile?.verification_status;
  const isTenant = profile?.account_type === "tenant";
  const hasDraft = !!(profile?.id_number && profile.id_document_path && profile.selfie_document_path);

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-xl px-5 py-12">
        <h1 className="text-3xl font-bold">Identity Verification</h1>
        <p className="mt-2 text-muted-foreground">Upload your NIN, ID and selfie, review the summary, then submit your identity for manual review.</p>

        {status === "approved" ? (
          <div className="mt-8 rounded-xl bg-card p-8 text-center shadow-card">
            <ShieldCheck className="mx-auto h-12 w-12 text-brand" />
            <h2 className="mt-3 text-xl font-bold">You're verified</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your identity has been approved.</p>
          </div>
        ) : status === "pending" ? (
          <div className="mt-8 rounded-xl bg-card p-8 text-center shadow-card">
            <Clock className="mx-auto h-12 w-12 text-brand" />
            <h2 className="mt-3 text-xl font-bold">Submitted for review</h2>
            <p className="mt-1 text-sm text-muted-foreground">Your ID and selfie are awaiting manual review.</p>
          </div>
        ) : profile && !["tenant", "landlord"].includes(profile.account_type) ? (
          <div className="mt-8 rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">Choose Tenant or Landlord in your account settings before submitting identity verification.</div>
        ) : step === "summary" && hasDraft ? (
          <section className="mt-8 space-y-5 rounded-xl bg-card p-6 shadow-card">
            {status === "rejected" && <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />Your previous submission was not approved. Review your details and submit a clear, valid ID again.</div>}
            <div>
              <h2 className="text-xl font-bold">Review your submission</h2>
              <p className="mt-1 text-sm text-muted-foreground">Your uploads are saved securely. Check the details before submitting.</p>
            </div>
            <dl className="grid gap-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Name</dt><dd className="font-medium">{profile?.full_name || "Not set"}</dd></div>
              <div><dt className="text-muted-foreground">ID type</dt><dd className="font-medium">{profile?.id_type || "National ID (NIN)"}</dd></div>
              <div><dt className="text-muted-foreground">{ID_NUMBER_FIELDS[profile?.id_type || ""]?.label || "ID number"}</dt><dd className="font-medium">•••••••{profile?.id_number?.slice(-4)}</dd></div>
              <div><dt className="text-muted-foreground">Uploads</dt><dd className="font-medium">ID document + selfie saved</dd></div>
            </dl>
            {isTenant ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm font-medium">Verification fee: Free (Tenant)</p>
            ) : profile?.verification_fee_paid ? (
              <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm font-medium">RentReady Verification Fee: Paid</p>
            ) : (
              <div className="rounded-lg bg-muted/50 p-4">
                <h3 className="font-semibold">RentReady Verification Fee · ₦1,500</h3>
                <p className="mt-1 text-sm text-muted-foreground">One-time fee covers manual ID + selfie review. Not monthly.</p>
                {paymentChecking && <p className="mt-3 text-sm text-muted-foreground" role="status">Confirming your payment… Submit for review will appear after payment is confirmed.</p>}
                <button type="button" disabled={paymentChecking} onClick={() => void startPaidPlan("nin_verification")} className="mt-4 w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:cursor-wait disabled:opacity-60">Pay RentReady Verification Fee · ₦1,500</button>
              </div>
            )}
            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="button" onClick={() => setStep("upload")} className="w-full rounded-lg border border-border py-3 font-medium">Edit uploads</button>
              {(isTenant || profile?.verification_fee_paid) && <button type="button" disabled={busy} onClick={() => void submitForReview()} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-60">{busy ? "Submitting…" : "Submit for review"}</button>}
            </div>
            {!isTenant && !profile?.verification_fee_paid && <p className="text-center text-xs text-muted-foreground">Submit for review will appear here after your payment is confirmed.</p>}
          </section>
        ) : (
          <form onSubmit={uploadForSummary} className="mt-8 space-y-4 rounded-xl bg-card p-6 shadow-card">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
              <p className="font-semibold">{isTenant ? "Tenant verification is free" : "Upload first, pay after"}</p>
              <p className="mt-1 text-muted-foreground">{isTenant ? "No payment is required to submit your NIN, ID and selfie." : "Landlords can upload their NIN, ID and selfie before paying the one-time RentReady Verification Fee."}</p>
            </div>
            {status === "rejected" && <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm"><XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />Your previous submission was not approved. Please check your details and upload a clear, valid ID again.</div>}
            <div><label className={label}>Name on your account</label><p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{profile?.full_name || "Name not set"}</p></div>
            <div><label className={label}>Phone number <span className="font-normal text-muted-foreground">(optional for identity review)</span></label><p className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm">{profile?.phone || "No phone number on profile"}</p></div>
            <div>
              <label className={label}>ID type</label>
              <select name="id_type" required className={input} value={selectedIdType} onChange={(event) => setSelectedIdType(event.target.value)}>{ID_TYPES.map((type) => <option key={type}>{type}</option>)}</select>
            </div>
            <div>
              <label className={label}>{ID_NUMBER_FIELDS[selectedIdType]?.label}</label>
              <input key={selectedIdType} name="id_number" required inputMode={selectedIdType === "National ID (NIN)" ? "numeric" : "text"} minLength={selectedIdType === "National ID (NIN)" ? 11 : 4} maxLength={selectedIdType === "National ID (NIN)" ? 11 : 32} pattern={selectedIdType === "National ID (NIN)" ? "[0-9]{11}" : "[A-Za-z0-9 /-]{4,32}"} placeholder={ID_NUMBER_FIELDS[selectedIdType]?.placeholder} className={input} />
            </div>
            <div>
              <label className={label}>Photo of your {selectedIdType === "National ID (NIN)" ? "NIN card" : selectedIdType}</label>
              <input name="document" type="file" required accept="image/jpeg,image/png,image/webp,application/pdf" className="text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">JPG, PNG, WebP or PDF, up to 10 MB. Only you and the review team can access it.</p>
            </div>
            <div>
              <label className={label}>Selfie holding your ID</label>
              <input name="selfie" type="file" required accept="image/jpeg,image/png,image/webp" className="text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">Use a clear selfie where your face and ID are visible. JPG, PNG or WebP, up to 10 MB.</p>
            </div>
            <button disabled={busy || !profile} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
              <UploadCloud className="h-4 w-4" />{busy ? "Uploading…" : "Upload and review summary"}
            </button>
          </form>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
