import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { BadgeCheck, Camera, ShieldCheck, UploadCloud } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { SiteFooter, SiteHeader } from "@/components/SiteHeader";
import { supabase } from "@/integrations/supabase/client";
import { startPaidPlan } from "@/lib/payments";

export const Route = createFileRoute("/_authenticated/blue-tick")({
  head: () => ({ meta: [{ title: "Blue Tick — RentReady" }, { name: "description", content: "Apply for RentReady Blue Tick verification." }] }),
  component: BlueTickPage,
});

function BlueTickPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState("");
  const [selfie, setSelfie] = useState<Blob | null>(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [idFile, setIdFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["blue-tick-profile", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("account_type, verification_status, verification_name_matched, id_type, id_number, blue_tick_status").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: subscription } = useQuery({
    queryKey: ["blue-tick-subscription", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("subscriptions").select("id, status, ends_at, cancel_at_period_end").eq("user_id", user.id).eq("plan", "blue_tick_monthly").order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const active = subscription?.status === "active" && (!subscription.ends_at || new Date(subscription.ends_at).getTime() > Date.now());
  const idVerified = profile?.account_type === "landlord" && profile.verification_status === "approved" && profile.verification_name_matched;

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  useEffect(() => () => stopCamera(), [stopCamera]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("payment")) return;
    setCheckingPayment(true);
    let attempts = 0;
    const timer = window.setInterval(() => {
      attempts += 1;
      void qc.invalidateQueries({ queryKey: ["blue-tick-subscription", user.id] });
      if (attempts >= 40) { window.clearInterval(timer); setCheckingPayment(false); toast.error("Payment confirmation is delayed. Refresh this page in a moment."); }
    }, 1500);
    return () => window.clearInterval(timer);
  }, [qc, user.id]);
  useEffect(() => { if (active) setCheckingPayment(false); }, [active]);

  async function startCamera() {
    setCameraError("");
    setSelfie(null);
    setSelfiePreview("");
    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      setCameraOn(true);
      if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
    } catch {
      setCameraError("Camera access is unavailable. Allow camera access and try again.");
    }
  }

  async function captureSelfie() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) { setCameraError("Start the camera and wait for the preview before capturing."); return; }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const photo = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    if (!photo) { setCameraError("Could not capture the selfie. Please try again."); return; }
    setSelfie(photo);
    setSelfiePreview(URL.createObjectURL(photo));
    stopCamera();
  }

  async function submitFaceMatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!idVerified || !active || !selfie || !idFile) { toast.error("ID verification, Blue Tick subscription, ID photo, and live selfie are required."); return; }
    if (!profile?.id_type || !profile.id_number) { toast.error("Complete free ID verification before applying for Blue Tick."); return; }
    if (idFile.size > 10 * 1024 * 1024 || selfie.size > 10 * 1024 * 1024) { toast.error("Each image must be smaller than 10 MB."); return; }
    setBusy(true);
    try {
      const submissionId = crypto.randomUUID();
      const idPath = `${user.id}/blue-tick/${submissionId}/id-${idFile.name.replace(/[^\w.-]/g, "_").slice(-100)}`;
      const selfiePath = `${user.id}/blue-tick/${submissionId}/live-selfie.jpg`;
      const idUpload = await supabase.storage.from("id-documents").upload(idPath, idFile, { contentType: idFile.type, upsert: false });
      if (idUpload.error) throw idUpload.error;
      const selfieUpload = await supabase.storage.from("id-documents").upload(selfiePath, selfie, { contentType: "image/jpeg", upsert: false });
      if (selfieUpload.error) throw selfieUpload.error;
      const { error } = await supabase.from("profiles").update({ blue_tick_status: "pending", blue_tick_id_document_path: idPath, blue_tick_selfie_path: selfiePath, blue_tick_submitted_at: new Date().toISOString() }).eq("id", user.id);
      if (error) throw error;
      await qc.invalidateQueries({ queryKey: ["blue-tick-profile", user.id] });
      toast.success("Blue Tick face match submitted for Admin review.");
      setIdFile(null); setSelfie(null); setSelfiePreview("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not submit Blue Tick documents. Try again.");
    } finally { setBusy(false); }
  }

  return <div className="min-h-screen bg-muted/40"><SiteHeader /><main className="mx-auto max-w-2xl px-5 py-10 pb-36">
    <div className="rounded-2xl bg-card p-6 shadow-card sm:p-8">
      <h1 className="flex items-center gap-2 text-3xl font-bold"><BadgeCheck className="h-7 w-7 text-blue-600" />Blue Tick Verification</h1>
      <p className="mt-2 text-muted-foreground">Optional premium verification for landlords. Your normal Verified badge remains if Blue Tick expires.</p>
      {isLoading ? <p className="mt-6 text-muted-foreground">Loading your verification status…</p> : !idVerified ? <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5"><p className="font-semibold">Free ID verification is required first.</p><p className="mt-1 text-sm text-muted-foreground">Complete Admin-approved ID verification before applying for Blue Tick.</p><Button asChild className="mt-4"><Link to="/verify">Complete free ID verification</Link></Button></div> : <>
        {profile.blue_tick_status === "approved" && active && <div className="mt-6 rounded-xl border border-blue-200 bg-blue-50 p-5 text-blue-900"><p className="flex items-center gap-2 font-bold"><BadgeCheck className="h-5 w-5" />Blue Tick active</p><p className="mt-1 text-sm">Subscription expires {subscription?.ends_at ? new Date(subscription.ends_at).toLocaleDateString("en-NG") : "at the end of the paid period"}.</p></div>}
        {profile.blue_tick_status === "pending" && <div className="mt-6 rounded-xl bg-muted/50 p-5"><p className="font-semibold">Face match review pending</p><p className="mt-1 text-sm text-muted-foreground">An Admin will compare your live selfie to your ID photo.</p></div>}
        {!active && <div className="mt-6 rounded-xl border border-border bg-muted/40 p-5"><p className="font-semibold">Blue Tick subscription · ₦10,000/month</p>{subscription?.ends_at && <p className="mt-1 text-sm text-muted-foreground">Previous subscription ended {new Date(subscription.ends_at).toLocaleDateString("en-NG")}.</p>}<Button disabled={checkingPayment} className="mt-4 w-full" onClick={() => void startPaidPlan("blue_tick_monthly")}>{checkingPayment ? "Confirming payment…" : subscription ? "Renew Blue Tick - ₦10,000/month" : "Get Blue Tick - ₦10,000/month"}</Button></div>}
        {active && profile.blue_tick_status !== "pending" && <form onSubmit={submitFaceMatch} className="mt-6 space-y-5 border-t border-border pt-6">
          <div><h2 className="font-semibold">1. Upload your ID again</h2><p className="mt-1 text-sm text-muted-foreground">Use your verified {profile.id_type} and make sure the photo is clear.</p><input type="file" accept="image/jpeg,image/png,image/webp,application/pdf" required onChange={(event) => setIdFile(event.target.files?.[0] ?? null)} className="mt-3 text-sm" /></div>
          <div><h2 className="font-semibold">2. Take a live selfie</h2><p className="mt-1 text-sm text-muted-foreground">Capture your face with the device camera. Uploaded selfie files are not accepted.</p>
            {selfiePreview ? <img src={selfiePreview} alt="Captured live selfie" className="mt-3 max-h-72 rounded-xl object-contain" /> : <video ref={videoRef} autoPlay playsInline muted className={`mt-3 max-h-72 w-full rounded-xl bg-black ${cameraOn ? "block" : "hidden"}`} />}
            <div className="mt-3 flex flex-wrap gap-3"><Button type="button" variant="outline" onClick={() => void startCamera()}><Camera className="mr-2 h-4 w-4" />Start camera</Button>{cameraOn && <Button type="button" onClick={() => void captureSelfie()}>Capture live selfie</Button>}</div>
            {cameraError && <p role="alert" className="mt-2 text-sm text-destructive">{cameraError}</p>}
          </div>
          <Button type="submit" disabled={busy || !idFile || !selfie} className="w-full">{busy ? "Submitting…" : <><UploadCloud className="mr-2 h-4 w-4" />Submit for face match check</>}</Button>
        </form>}
        <p className="mt-6 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />Blue Tick ranking and badge require both Admin approval and an active monthly subscription.</p>
      </>}
    </div>
  </main><SiteFooter /></div>;
}
