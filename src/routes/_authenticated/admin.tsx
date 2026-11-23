import { createFileRoute, redirect } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Eye, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdminPhaseOne } from "@/components/AdminPhaseOne";
import { AdminIdentityReviewDialog, type AdminReviewPerson } from "@/components/AdminIdentityReviewDialog";

export const Route = createFileRoute("/_authenticated/admin")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth", search: { mode: "signin" } });
    const { data: role, error } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
    if (error || !role) throw redirect({ to: "/" });
  },
  head: () => ({
    meta: [
      { title: "Admin — RentReady" },
      { name: "description", content: "Review identity verifications and site activity." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type PendingUser = AdminReviewPerson;

type Notification = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
};
type ReviewFlag = { id: string; full_name: string | null; phone: string | null };

function AdminPage() {
  const { user } = Route.useRouteContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [reviewFlags, setReviewFlags] = useState<ReviewFlag[]>([]);
  const [visitorCount, setVisitorCount] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [selectedVerification, setSelectedVerification] = useState<PendingUser | null>(null);

  const load = useCallback(async () => {
    const { data: role } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(!!role);
    if (!role) return;
    const [{ data: p, error: pError }, { data: directory, error: directoryError }, { data: n }, { data: r }, { data: visits }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, account_type, approval_status, id_type, id_document_path, selfie_document_path, verification_status, created_at")
        .eq("account_type", "landlord").eq("approval_status", "approved").neq("verification_status", "approved").order("created_at", { ascending: false }),
      supabase.rpc("admin_user_directory", { _search: null }),
      supabase.from("admin_notifications").select("id, kind, message, created_at").order("created_at", { ascending: false }).limit(50),
      supabase.from("profiles").select("id, full_name, phone").eq("account_review_required", true),
      supabase.rpc("admin_site_visit_count"),
    ]);
    if (pError) toast.error("Could not load the identity review queue");
    if (directoryError) toast.error("Could not load applicant email addresses");
    const emailById = new Map((directory ?? []).map((person) => [person.id, person.email]));
    setPending((p ?? []).map((person) => ({ ...person, email: emailById.get(person.id) ?? "Email unavailable" })));
    setNotifications(n ?? []);
    setReviewFlags(r ?? []);
    setVisitorCount(visits ?? 0);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approved: boolean): Promise<boolean> {
    const applicant = pending.find((profile) => profile.id === id);
    if (!applicant?.id_document_path || !applicant.selfie_document_path) {
      toast.error("Awaiting both ID and selfie uploads before an identity decision.");
      return false;
    }
    setBusyId(id);
    const { error } = await supabase.from("profiles").update(
      approved
        ? { verification_status: "approved", verified_at: new Date().toISOString(), verification_name_matched: true }
        : { verification_status: "rejected", verification_name_matched: false },
    ).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return false; }
    toast.success(approved ? "User approved — they can now post" : "Submission rejected");
    setPending((list) => list.filter((p) => p.id !== id));
    setSelectedVerification(null);
    return true;
  }

  async function clearReview(id: string) {
    const { error } = await supabase.from("profiles").update({ account_review_required: false }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    setReviewFlags((flags) => flags.filter((flag) => flag.id !== id));
    toast.success("Account review flag cleared");
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen bg-muted/40">
        <SiteHeader />
        <div className="mx-auto max-w-xl px-5 py-20 text-center">
          <ShieldX className="mx-auto h-12 w-12 text-muted-foreground" />
          <h1 className="mt-4 text-2xl font-bold">Admins only</h1>
          <p className="mt-2 text-muted-foreground">This area is restricted to the RentReady review team.</p>
        </div>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-4xl px-5 py-10">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <p className="mt-1 text-muted-foreground">Approve identities and watch site activity.</p>
        <div className="mt-5 inline-flex items-center gap-2 rounded-xl bg-card px-5 py-4 shadow-card"><Eye className="h-5 w-5 text-primary" /><span className="text-2xl font-bold">{visitorCount ?? "—"}</span><span className="text-sm text-muted-foreground">homepage visits</span></div>

        <AdminPhaseOne />

        <h2 className="mt-10 text-xl font-bold">Identity verification review queue ({pending.length})</h2>
        <p className="mt-1 text-sm text-muted-foreground">Open a landlord to view their ID and selfie before deciding. Accounts without an ID remain in the queue as awaiting upload.</p>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">No landlord identity reviews are waiting.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((p) => (
              <button key={p.id} type="button" onClick={() => setSelectedVerification(p)} className="flex w-full flex-wrap items-center justify-between gap-4 rounded-xl bg-card p-5 text-left shadow-card transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                <span>
                  <span className="block font-semibold">{p.full_name ?? "Unnamed user"}</span>
                  <span className="mt-1 block text-sm text-muted-foreground">{p.email} · {p.phone ?? "No phone"} · Landlord</span>
                  <span className="mt-1 block text-xs text-muted-foreground">Joined {new Date(p.created_at).toLocaleDateString("en-NG")}{p.id_type ? ` · ${p.id_type}` : ""}</span>
                </span>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${p.id_document_path ? "bg-primary/10 text-primary" : "bg-amber-500/10 text-amber-700"}`}>
                  {p.id_document_path ? "ID Uploaded" : "Awaiting ID Upload"}
                </span>
              </button>
            ))}
          </div>
        )}
        <AdminIdentityReviewDialog
          open={!!selectedVerification}
          onOpenChange={(open) => { if (!open) setSelectedVerification(null); }}
          person={selectedVerification}
          mode="identity"
          busy={selectedVerification ? busyId === selectedVerification.id : false}
          onApprove={() => { if (selectedVerification) void decide(selectedVerification.id, true); }}
          onReject={() => { if (selectedVerification) void decide(selectedVerification.id, false); }}
        />

        <h2 className="mt-10 text-xl font-bold">Landlord accounts under review ({reviewFlags.length})</h2>
        {reviewFlags.length === 0 ? <p className="mt-3 text-sm text-muted-foreground">No landlord accounts are currently flagged.</p> : <div className="mt-3 space-y-3">{reviewFlags.map((flag) => <div key={flag.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-5 shadow-card"><div><p className="font-semibold">{flag.full_name ?? "Unnamed landlord"}</p><p className="text-sm text-muted-foreground">{flag.phone ?? "No phone on profile"} · Three or more ratings below 3 stars</p></div><button onClick={() => void clearReview(flag.id)} className="rounded-lg border border-primary px-3 py-2 text-sm font-medium text-primary">Clear review flag</button></div>)}</div>}

        <h2 className="mt-10 flex items-center gap-2 text-xl font-bold"><Bell className="h-5 w-5" /> Activity</h2>
        <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-card">
          {notifications.length === 0 && <p className="p-6 text-sm text-muted-foreground">No activity yet.</p>}
          {notifications.map((n) => (
            <div key={n.id} className="flex items-center justify-between gap-4 px-5 py-3 text-sm">
              <span><span className="mr-2 rounded bg-muted px-2 py-0.5 text-xs font-medium uppercase">{n.kind}</span>{n.message}</span>
              <span className="shrink-0 text-xs text-muted-foreground">{new Date(n.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      </div>
      <SiteFooter />
    </div>
  );
}
