import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ShieldCheck, Clock, XCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

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
  verification_status: string;
  id_type: string | null;
};

const ID_TYPES = ["International Passport", "National ID (NIN)", "Driver's License"];

function VerifyPage() {
  const { user } = Route.useRouteContext();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.from("profiles").select("full_name, verification_status, id_type").eq("id", user.id).maybeSingle()
      .then(({ data }) => setProfile(data));
  }, [user.id]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    const file = f.get("document") as File;
    if (!file || !file.size) { toast.error("Please upload a photo of your ID document"); return; }
    setBusy(true);
    const path = `${user.id}/${crypto.randomUUID()}-${file.name.replace(/[^\w.]/g, "")}`;
    const up = await supabase.storage.from("id-documents").upload(path, file);
    if (up.error) { setBusy(false); toast.error("Document upload failed — try again"); return; }
    const { error } = await supabase.from("profiles").update({
      id_type: String(f.get("id_type")),
      id_number: String(f.get("id_number")),
      id_document_path: path,
      verification_status: "pending",
    }).eq("id", user.id);
    if (error) { setBusy(false); toast.error(error.message); return; }
    await supabase.from("admin_notifications").insert({
      user_id: user.id, kind: "verification",
      message: `Verification submitted: ${profile?.full_name ?? "A user"} (${String(f.get("id_type"))})`,
    });
    setBusy(false);
    toast.success("Documents submitted for review");
    setProfile((p) => p && { ...p, verification_status: "pending" });
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
        ) : (
          <form onSubmit={onSubmit} className="mt-8 space-y-4 rounded-xl bg-card p-6 shadow-card">
            {status === "rejected" && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                Your previous submission was not approved. Please check your details and submit a clear, valid ID again.
              </div>
            )}
            <div>
              <label className={label}>ID type</label>
              <select name="id_type" required className={input}>
                {ID_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className={label}>ID number</label>
              <input name="id_number" required placeholder="e.g. NIN or passport number" className={input} />
            </div>
            <div>
              <label className={label}>Photo of the document</label>
              <input name="document" type="file" required accept="image/*,.pdf" className="text-sm" />
              <p className="mt-1 text-xs text-muted-foreground">A clear photo or scan. Only visible to the review team.</p>
            </div>
            <button disabled={busy} className="w-full rounded-lg bg-primary py-3 font-medium text-primary-foreground disabled:opacity-60">
              {busy ? "Submitting…" : "Submit for approval"}
            </button>
          </form>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
