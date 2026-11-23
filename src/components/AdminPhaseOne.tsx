import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AdminListings } from "@/components/AdminListings";
import { AdminIdentityReviewDialog, type AdminReviewPerson } from "@/components/AdminIdentityReviewDialog";
import { Button } from "@/components/ui/button";
import { formatNaira } from "@/lib/listings";
import { supabase } from "@/integrations/supabase/client";

type Tab = "people-waiting" | "listings-waiting" | "all-people" | "all-listings";
type Person = { id: string; email: string; full_name: string | null; phone: string | null; account_type: string; approval_status: string; rejection_reason: string | null; is_blocked: boolean; created_at: string };
type VerificationMeta = { id: string; id_type: string | null; id_document_path: string | null; selfie_document_path: string | null; verification_status: string };
type AdminStats = { total_users: number; landlords: number; tenants: number; pending_approvals: number; available_listings: number; pending_listings: number; rented_listings: number; expired_listings: number; signups_today: number; listings_today: number; premium_today: number; monthly_revenue_ngn: number; open_support_tickets: number };

const tabs: { id: Tab; label: string }[] = [
  { id: "people-waiting", label: "People Waiting" },
  { id: "listings-waiting", label: "Listings Waiting" },
  { id: "all-people", label: "All People" },
  { id: "all-listings", label: "All Listings" },
];

export function AdminPhaseOne() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("people-waiting");
  const [roleFilter, setRoleFilter] = useState<"all" | "tenant" | "landlord">("all");
  const [search, setSearch] = useState("");
  const [selectedPerson, setSelectedPerson] = useState<AdminReviewPerson | null>(null);
  const [approvalBusy, setApprovalBusy] = useState(false);
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_dashboard_stats");
      if (error) throw error;
      return data as unknown as AdminStats;
    },
  });
  const { data: people = [] } = useQuery({
    queryKey: ["admin-people", search],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_user_directory", { _search: search.trim() || null });
      if (error) throw error;
      return (data ?? []) as Person[];
    },
  });
  const verificationMetaQuery = useQuery({
    queryKey: ["admin-person-verification-meta", people.map((person) => person.id)],
    enabled: people.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles")
        .select("id, id_type, id_document_path, selfie_document_path, verification_status")
        .in("id", people.map((person) => person.id));
      if (error) throw error;
      return (data ?? []) as VerificationMeta[];
    },
  });
  const { data: listings = [] } = useQuery({
    queryKey: ["admin-all-listings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select("id,title,state,city,status,availability_status,created_at")
        .eq("is_sample", false).order("created_at", { ascending: false }).limit(300);
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: premium = [] } = useQuery({
    queryKey: ["admin-premium-subscriptions"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_premium_subscriptions");
      if (error) throw error;
      return data ?? [];
    },
  });
  const { data: tickets = [] } = useQuery({
    queryKey: ["admin-support-tickets"],
    queryFn: async () => {
      const { data, error } = await supabase.from("support_tickets").select("id,contact_email,category,details,status,page_url,created_at")
        .order("created_at", { ascending: false }).limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateAdmin = async () => {
    await Promise.all([
      qc.invalidateQueries({ queryKey: ["admin-dashboard-stats"] }),
      qc.invalidateQueries({ queryKey: ["admin-people"] }),
      qc.invalidateQueries({ queryKey: ["admin-all-listings"] }),
      qc.invalidateQueries({ queryKey: ["admin-premium-subscriptions"] }),
      qc.invalidateQueries({ queryKey: ["admin-support-tickets"] }),
      qc.invalidateQueries({ queryKey: ["admin-pending-listings"] }),
    ]);
  };
  async function setApproval(person: Person, approval_status: "approved" | "rejected"): Promise<boolean> {
    let rejection_reason: string | null = null;
    if (approval_status === "rejected") {
      const reason = window.prompt("Choose a rejection reason: Fake profile / Incomplete / Suspicious / Other", "Incomplete");
      if (reason === null) return false;
      rejection_reason = ["Fake profile", "Incomplete", "Suspicious", "Other"].includes(reason) ? reason : "Other";
    }
    const { error } = await supabase.from("profiles").update({
      approval_status,
      rejection_reason,
      approved_at: approval_status === "approved" ? new Date().toISOString() : null,
    }).eq("id", person.id);
    if (error) { toast.error(error.message); return false; }
    toast.success(approval_status === "approved" ? `${person.full_name || "User"} approved` : "Account rejected");
    await invalidateAdmin();
    return true;
  }
  async function toggleBlock(person: Person) {
    const { error } = await supabase.from("profiles").update({ is_blocked: !person.is_blocked }).eq("id", person.id);
    if (error) { toast.error(error.message); return; }
    toast.success(person.is_blocked ? "Account unblocked" : "Account blocked");
    await invalidateAdmin();
  }
  async function setAvailability(id: string, availability_status: "available" | "rented") {
    const { error } = await supabase.from("listings").update({ availability_status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(availability_status === "rented" ? "Listing marked rented" : "Listing marked available");
    await invalidateAdmin();
  }
  async function deleteListing(id: string) {
    if (!window.confirm("Delete this listing permanently?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing deleted");
    await invalidateAdmin();
  }
  async function resolveTicket(id: string) {
    const { error } = await supabase.from("support_tickets").update({ status: "resolved", resolved_at: new Date().toISOString() }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Support ticket resolved");
    await invalidateAdmin();
  }

  const pendingPeople = people.filter((person) => person.approval_status === "pending" && (roleFilter === "all" || person.account_type === roleFilter));
  const verificationMetaById = new Map((verificationMetaQuery.data ?? []).map((meta) => [meta.id, meta]));
  function openPerson(person: Person) {
    const meta = verificationMetaById.get(person.id);
    if (!meta) {
      toast.error("Could not load this user's verification details. Please retry.");
      return;
    }
    setSelectedPerson({ ...person, ...meta });
  }
  async function decideAccount(approval_status: "approved" | "rejected") {
    if (!selectedPerson) return;
    const accountPerson = people.find((person) => person.id === selectedPerson.id);
    if (!accountPerson) return;
    setApprovalBusy(true);
    try {
      const saved = await setApproval(accountPerson, approval_status);
      if (saved) setSelectedPerson(null);
    } finally {
      setApprovalBusy(false);
    }
  }
  const card = "rounded-xl bg-card p-4 shadow-card sm:p-5";
  return <section className="mt-8 space-y-8">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {[
        ["Total users", stats?.total_users ?? "—"], ["Landlords", stats?.landlords ?? "—"], ["Tenants", stats?.tenants ?? "—"], ["Pending approvals", stats?.pending_approvals ?? "—"],
        ["Available listings", stats?.available_listings ?? "—"], ["Listings waiting", stats?.pending_listings ?? "—"], ["Rented listings", stats?.rented_listings ?? "—"], ["Expired listings", stats?.expired_listings ?? "—"],
        ["Signups today", stats?.signups_today ?? "—"], ["Listings today", stats?.listings_today ?? "—"], ["Premium today", stats?.premium_today ?? "—"], ["Open support tickets", stats?.open_support_tickets ?? "—"],
      ].map(([label, value]) => <div className={card} key={String(label)}><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-2xl font-bold">{value}</p></div>)}
      <div className={card}><p className="text-xs text-muted-foreground">Monthly premium revenue</p><p className="mt-1 text-2xl font-bold">{formatNaira(Number(stats?.monthly_revenue_ngn ?? 0))}</p></div>
    </div>

    <div className="flex flex-wrap gap-2" role="tablist" aria-label="Admin dashboard sections">
      {tabs.map((item) => <button key={item.id} role="tab" aria-selected={tab === item.id} onClick={() => setTab(item.id)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${tab === item.id ? "bg-primary text-primary-foreground" : "bg-card text-foreground"}`}>{item.label}</button>)}
    </div>

    {tab === "people-waiting" && <div className="space-y-4">
      <div className={card}><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-lg font-bold">People Waiting for Account Approval</h2><p className="text-sm text-muted-foreground">Open a person to review their account details. Account approval is separate from landlord identity verification.</p></div><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value as typeof roleFilter)} className="rounded-lg border border-input bg-background px-3 py-2 text-sm"><option value="all">All roles</option><option value="tenant">Tenant</option><option value="landlord">Landlord</option></select></div></div>
      {pendingPeople.length === 0 ? <div className={card}><p className="text-sm text-muted-foreground">No people are waiting for approval.</p></div> : pendingPeople.map((person) => {
        const meta = verificationMetaById.get(person.id);
        const idStatus = verificationMetaQuery.isLoading ? "Checking ID status…" : verificationMetaQuery.isError ? "ID status unavailable" : meta?.id_document_path ? "ID Uploaded" : "No ID Uploaded";
        return <button key={person.id} type="button" onClick={() => openPerson(person)} disabled={verificationMetaQuery.isLoading || verificationMetaQuery.isError} className={`${card} flex w-full flex-wrap items-center justify-between gap-4 text-left transition hover:ring-2 hover:ring-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:cursor-wait disabled:opacity-70`} aria-label={`Open review details for ${person.full_name || person.email}`}>
          <span><span className="block font-semibold">{person.full_name || "Unnamed user"}</span><span className="mt-1 block text-sm text-muted-foreground">{person.email} · {person.phone || "No phone"}</span><span className="mt-1 block text-xs capitalize text-muted-foreground">{person.account_type} · Joined {new Date(person.created_at).toLocaleDateString("en-NG")}</span></span>
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${meta?.id_document_path ? "bg-primary/10 text-primary" : "bg-primary/10 text-primary"}`}>{idStatus}</span>
        </button>;
      })}
      <AdminIdentityReviewDialog
        open={!!selectedPerson}
        onOpenChange={(open) => { if (!open) setSelectedPerson(null); }}
        person={selectedPerson}
        mode="account"
        busy={approvalBusy}
        onApprove={() => void decideAccount("approved")}
        onReject={() => void decideAccount("rejected")}
      />
    </div>}
    {tab === "listings-waiting" && <div className={card}><h2 className="text-lg font-bold">Listings Waiting</h2><AdminListings /></div>}
    {tab === "all-people" && <div className="space-y-4"><div className={card}><h2 className="text-lg font-bold">All People</h2><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by email or name" className="mt-3 h-11 w-full rounded-lg border border-input bg-background px-3 text-sm" /></div>{people.map((person) => <div key={person.id} className={`${card} flex flex-wrap items-center justify-between gap-4`}><div><p className="font-semibold">{person.full_name || "Unnamed user"}</p><p className="text-sm text-muted-foreground">{person.email} · {person.phone || "No phone"}</p><p className="text-xs capitalize text-muted-foreground">{person.account_type} · {person.approval_status}{person.is_blocked ? " · blocked" : ""}{person.rejection_reason ? ` · ${person.rejection_reason}` : ""}</p></div><div className="flex flex-wrap gap-2">{person.approval_status !== "approved" && <Button size="sm" onClick={() => void setApproval(person, "approved")}>Approve</Button>}{person.approval_status !== "rejected" && <Button size="sm" variant="outline" onClick={() => void setApproval(person, "rejected")}>Reject</Button>}<Button size="sm" variant="outline" onClick={() => void toggleBlock(person)}>{person.is_blocked ? "Unblock" : "Block"}</Button></div></div>)}</div>}
    {tab === "all-listings" && <div className="space-y-3"><h2 className="text-lg font-bold">All Listings</h2>{listings.map((listing) => <div key={listing.id} className={`${card} flex flex-wrap items-center justify-between gap-3`}><div><p className="font-semibold">{listing.title}</p><p className="text-xs capitalize text-muted-foreground">{listing.city}, {listing.state} · approval: {listing.status} · availability: {listing.availability_status}</p></div><div className="flex flex-wrap gap-2">{listing.availability_status === "available" ? <Button size="sm" variant="outline" onClick={() => void setAvailability(listing.id, "rented")}>Mark rented</Button> : <Button size="sm" variant="outline" onClick={() => void setAvailability(listing.id, "available")}>Mark available</Button>}<Button size="sm" variant="destructive" onClick={() => void deleteListing(listing.id)}>Delete</Button></div></div>)}</div>}

    <section className="space-y-3"><h2 className="text-xl font-bold">Premium subscriptions</h2><div className="overflow-x-auto rounded-xl bg-card shadow-card"><table className="w-full min-w-[680px] text-left text-sm"><thead className="border-b border-border text-xs text-muted-foreground"><tr><th className="p-3">User</th><th className="p-3">Plan</th><th className="p-3">Status</th><th className="p-3">Amount</th><th className="p-3">Period end</th></tr></thead><tbody>{premium.map((item, index) => <tr key={`${item.user_email}-${item.plan}-${index}`} className="border-b border-border"><td className="p-3">{item.full_name || item.user_email}<div className="text-xs text-muted-foreground">{item.user_email}</div></td><td className="p-3">{item.plan === "nin_verification" ? "RentReady Verification Fee" : item.plan}</td><td className="p-3 capitalize">{item.status}</td><td className="p-3">{formatNaira(Number(item.amount_ngn))}</td><td className="p-3">{item.ends_at ? new Date(item.ends_at).toLocaleDateString("en-NG") : "—"}</td></tr>)}{premium.length === 0 && <tr><td className="p-4 text-muted-foreground" colSpan={5}>No premium subscriptions.</td></tr>}</tbody></table></div></section>

    <section className="space-y-3"><h2 className="text-xl font-bold">Support tickets</h2>{tickets.length === 0 ? <div className={card}><p className="text-sm text-muted-foreground">No support tickets.</p></div> : tickets.map((ticket) => <div key={ticket.id} className={`${card} flex flex-wrap items-start justify-between gap-3`}><div><p className="font-semibold">{ticket.category} <span className="ml-2 text-xs font-normal capitalize text-muted-foreground">{ticket.status}</span></p><p className="mt-1 text-sm">{ticket.details}</p><p className="mt-1 text-xs text-muted-foreground">{ticket.contact_email || "Visitor"} · {new Date(ticket.created_at).toLocaleString("en-NG")}{ticket.page_url ? ` · ${ticket.page_url}` : ""}</p></div>{ticket.status === "open" && <Button size="sm" variant="outline" onClick={() => void resolveTicket(ticket.id)}>Resolve</Button>}</div>)}</section>
  </section>;
}
