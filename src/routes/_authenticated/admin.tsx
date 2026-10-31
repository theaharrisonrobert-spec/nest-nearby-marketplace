import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Bell, Check, Eye, ShieldX, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { AdminListings } from "@/components/AdminListings";

export const Route = createFileRoute("/_authenticated/admin")({
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

type PendingUser = {
  id: string;
  full_name: string | null;
  phone: string | null;
  id_type: string | null;
  id_number: string | null;
  id_document_path: string | null;
  created_at: string;
};

type Notification = {
  id: string;
  kind: string;
  message: string;
  created_at: string;
};

function AdminPage() {
  const { user } = Route.useRouteContext();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: role } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    setIsAdmin(!!role);
    if (!role) return;
    const [{ data: p }, { data: n }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, phone, id_type, id_number, id_document_path, created_at")
        .eq("verification_status", "pending").not("id_type", "is", null).order("created_at", { ascending: false }),
      supabase.from("admin_notifications").select("id, kind, message, created_at").order("created_at", { ascending: false }).limit(50),
    ]);
    setPending(p ?? []);
    setNotifications(n ?? []);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  async function decide(id: string, approved: boolean) {
    setBusyId(id);
    const { error } = await supabase.from("profiles").update(
      approved
        ? { verification_status: "approved", verified_at: new Date().toISOString() }
        : { verification_status: "rejected" },
    ).eq("id", id);
    setBusyId(null);
    if (error) { toast.error(error.message); return; }
    toast.success(approved ? "User approved — they can now post" : "Submission rejected");
    setPending((list) => list.filter((p) => p.id !== id));
  }

  async function viewDocument(path: string) {
    const { data, error } = await supabase.storage.from("id-documents").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) { toast.error("Could not open document"); return; }
    window.open(data.signedUrl, "_blank", "noopener");
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

        <h2 className="mt-10 text-xl font-bold">Pending verifications ({pending.length})</h2>
        {pending.length === 0 ? (
          <p className="mt-3 rounded-xl bg-card p-6 text-sm text-muted-foreground shadow-card">No one is waiting for approval right now.</p>
        ) : (
          <div className="mt-3 space-y-3">
            {pending.map((p) => (
              <div key={p.id} className="rounded-xl bg-card p-5 shadow-card">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{p.full_name ?? "Unnamed user"}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {p.id_type} · {p.id_number} · {p.phone ?? "no phone"}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">Joined {new Date(p.created_at).toLocaleDateString()}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {p.id_document_path && (
                      <button onClick={() => viewDocument(p.id_document_path!)} className="flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted">
                        <Eye className="h-4 w-4" /> View ID
                      </button>
                    )}
                    <button disabled={busyId === p.id} onClick={() => decide(p.id, true)} className="flex items-center gap-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-60">
                      <Check className="h-4 w-4" /> Approve
                    </button>
                    <button disabled={busyId === p.id} onClick={() => decide(p.id, false)} className="flex items-center gap-1 rounded-lg border border-destructive px-3 py-2 text-sm text-destructive hover:bg-destructive/10 disabled:opacity-60">
                      <X className="h-4 w-4" /> Reject
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {isAdmin && <AdminListings />}

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
