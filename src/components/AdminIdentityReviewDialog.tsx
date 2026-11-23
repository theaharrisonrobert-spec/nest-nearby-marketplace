import { useEffect, useState } from "react";
import { Check, Download, Minus, Plus, ZoomIn } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type AdminReviewPerson = {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  account_type: string;
  created_at: string;
  approval_status?: string;
  id_type: string | null;
  id_document_path: string | null;
  selfie_document_path: string | null;
  verification_status: string;
  verification_fee_paid?: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  person: AdminReviewPerson | null;
  mode: "account" | "identity";
  busy?: boolean;
  onApprove?: () => void | Promise<void>;
  onReject?: () => void | Promise<void>;
};

type SignedDocument = { preview: string; download: string };

function isPdf(path: string) {
  return path.toLowerCase().split("?")[0]?.endsWith(".pdf") ?? false;
}

function DocumentPanel({
  label,
  path,
  document,
  onLoaded,
  onFailed,
  zoom,
  onZoomChange,
}: {
  label: string;
  path: string | null;
  document: SignedDocument | null;
  onLoaded: () => void;
  onFailed: () => void;
  zoom: number;
  onZoomChange: (zoom: number) => void;
}) {
  if (!path) {
    return <div className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">{label}: not uploaded</div>;
  }

  return (
    <section className="min-w-0 rounded-lg border border-border p-3">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-semibold">{label}</h3>
        <div className="flex items-center gap-2">
          {!isPdf(path) && (
            <>
              <button type="button" aria-label={`Zoom out ${label.toLowerCase()}`} onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))} className="rounded border border-border p-2 disabled:opacity-50" disabled={zoom <= 0.5}>
                <Minus className="h-4 w-4" />
              </button>
              <span className="min-w-12 text-center text-xs text-muted-foreground">{Math.round(zoom * 100)}%</span>
              <button type="button" aria-label={`Zoom in ${label.toLowerCase()}`} onClick={() => onZoomChange(Math.min(3, zoom + 0.25))} className="rounded border border-border p-2 disabled:opacity-50" disabled={zoom >= 3}>
                <Plus className="h-4 w-4" />
              </button>
            </>
          )}
          {document && (
            <a href={document.download} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded border border-border px-3 py-2 text-sm font-medium hover:bg-muted">
              <Download className="h-4 w-4" /> Download
            </a>
          )}
        </div>
      </div>
      <div className="max-h-[55vh] min-h-40 overflow-auto rounded bg-muted/50 p-2">
        {!document ? (
          <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">Loading secure preview…</div>
        ) : isPdf(path) ? (
          <iframe title={`${label} document preview`} src={document.preview} onLoad={onLoaded} onError={onFailed} className="h-[55vh] min-h-80 w-full rounded bg-white" />
        ) : (
          <div className="flex min-h-40 items-center justify-center">
            <img
              src={document.preview}
              alt={`${label} uploaded by applicant`}
              onLoad={onLoaded}
              onError={onFailed}
              style={{ transform: `scale(${zoom})`, transformOrigin: "center center" }}
              className="max-h-[50vh] max-w-full object-contain transition-transform"
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function AdminIdentityReviewDialog({
  open,
  onOpenChange,
  person,
  mode,
  busy = false,
  onApprove,
  onReject,
}: Props) {
  const [idDocument, setIdDocument] = useState<SignedDocument | null>(null);
  const [selfieDocument, setSelfieDocument] = useState<SignedDocument | null>(null);
  const [idLoaded, setIdLoaded] = useState(false);
  const [selfieLoaded, setSelfieLoaded] = useState(false);
  const [nameMatchConfirmed, setNameMatchConfirmed] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(false);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setIdDocument(null);
    setSelfieDocument(null);
    setIdLoaded(false);
    setSelfieLoaded(false);
    setNameMatchConfirmed(false);
    setZoom(1);
    setLoadFailed(false);

    if (!open || !person) return;

    const loadDocuments = async () => {
      setLoading(true);
      const sign = async (path: string | null): Promise<SignedDocument | null> => {
        if (!path) return null;
        let lastError: Error | null = null;
        for (const bucket of ["id-documents", "verification-documents"]) {
          const [preview, download] = await Promise.all([
            supabase.storage.from(bucket).createSignedUrl(path, 600),
            supabase.storage.from(bucket).createSignedUrl(path, 600, { download: true }),
          ]);
          if (!preview.error && !download.error && preview.data?.signedUrl && download.data?.signedUrl) {
            return { preview: preview.data.signedUrl, download: download.data.signedUrl };
          }
          lastError = preview.error ?? download.error ?? new Error("Could not create a secure document link");
        }
        throw lastError ?? new Error("Could not create a secure document link");
      };

      try {
        const [id, selfie] = await Promise.all([
          sign(person.id_document_path),
          sign(person.selfie_document_path),
        ]);
        if (cancelled) return;
        setIdDocument(id);
        setSelfieDocument(selfie);
      } catch {
        if (cancelled) return;
        setLoadFailed(true);
        toast.error("Could not load private verification documents. Check Admin Storage access and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void loadDocuments();
    return () => { cancelled = true; };
  }, [open, person]);

  const hasBothDocuments = !!person?.id_document_path && !!person.selfie_document_path;
  const previewsReady = hasBothDocuments && idLoaded && selfieLoaded && !loadFailed && !loading;
  const identityActionsReady = mode === "identity" && previewsReady;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-5xl overflow-y-auto pb-24 sm:pb-6">
        {person && (
          <>
            <DialogHeader>
              <DialogTitle>{person.full_name || "Unnamed user"}</DialogTitle>
              <DialogDescription>
                {mode === "identity" ? "Review identity documents before making a verification decision." : "Account approval is separate from landlord identity verification."}
              </DialogDescription>
            </DialogHeader>

            <dl className="grid gap-x-6 gap-y-3 rounded-lg bg-muted/40 p-4 text-sm sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Full name</dt><dd className="font-medium">{person.full_name || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Email</dt><dd className="break-all font-medium">{person.email}</dd></div>
              <div><dt className="text-muted-foreground">Phone</dt><dd className="font-medium">{person.phone || "—"}</dd></div>
              <div><dt className="text-muted-foreground">Role</dt><dd className="font-medium capitalize">{person.account_type}</dd></div>
              <div><dt className="text-muted-foreground">Date joined</dt><dd className="font-medium">{new Date(person.created_at).toLocaleString("en-NG")}</dd></div>
              <div><dt className="text-muted-foreground">ID type</dt><dd className="font-medium">{person.id_type || "Not provided"}</dd></div>
              {mode === "identity" && <div><dt className="text-muted-foreground">Verification fee</dt><dd className="font-medium">{person.account_type === "tenant" ? "Free (Tenant)" : person.verification_fee_paid ? "Paid" : "Not Paid"}</dd></div>}
            </dl>

            <section aria-label="Identity document status" className="space-y-3">
              {!person.id_document_path ? (
                <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm font-medium">Awaiting ID Upload — identity approval is unavailable until an ID is uploaded.</p>
              ) : (
                <p className="rounded-lg border border-primary/30 bg-primary/5 p-4 text-sm font-medium">ID Uploaded{person.selfie_document_path ? " · Selfie uploaded" : " · Awaiting selfie upload"}</p>
              )}
              <div className="grid gap-4 lg:grid-cols-2">
                <DocumentPanel label="ID document" path={person.id_document_path} document={idDocument} onLoaded={() => setIdLoaded(true)} onFailed={() => setLoadFailed(true)} zoom={zoom} onZoomChange={setZoom} />
                <DocumentPanel label="Selfie" path={person.selfie_document_path} document={selfieDocument} onLoaded={() => setSelfieLoaded(true)} onFailed={() => setLoadFailed(true)} zoom={zoom} onZoomChange={setZoom} />
              </div>
            </section>

            {mode === "identity" && (
              <div className="space-y-4 border-t border-border pt-4">
                {!hasBothDocuments && <p className="text-sm text-muted-foreground">Upload both the ID and selfie before this submission can be reviewed.</p>}
                {hasBothDocuments && (
                  <label className="flex items-start gap-2 text-sm">
                    <input type="checkbox" checked={nameMatchConfirmed} disabled={!previewsReady} onChange={(event) => setNameMatchConfirmed(event.target.checked)} className="mt-1" />
                    <span>I viewed both documents and manually confirmed the name on the ID matches the registered name above.</span>
                  </label>
                )}
                <div className="flex flex-wrap justify-end gap-3">
                  <button type="button" disabled={!identityActionsReady || busy} onClick={() => void onReject?.()} className="rounded-lg border border-destructive px-4 py-2 font-medium text-destructive disabled:cursor-not-allowed disabled:opacity-50">Reject identity</button>
                  <button type="button" disabled={!identityActionsReady || !nameMatchConfirmed || busy} onClick={() => void onApprove?.()} className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"><Check className="h-4 w-4" />Approve identity</button>
                </div>
              </div>
            )}

            {mode === "account" && (
              <div className="flex flex-wrap justify-end gap-3 border-t border-border pt-4">
                <span className="mr-auto self-center text-xs text-muted-foreground"><ZoomIn className="mr-1 inline h-3.5 w-3.5" />Document zoom controls are available above.</span>
                <button type="button" disabled={busy} onClick={() => void onReject?.()} className="rounded-lg border border-destructive px-4 py-2 font-medium text-destructive disabled:opacity-50">Reject account</button>
                <button type="button" disabled={busy} onClick={() => void onApprove?.()} className="rounded-lg bg-primary px-4 py-2 font-medium text-primary-foreground disabled:opacity-50">Approve account</button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
