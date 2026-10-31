import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatNaira, LISTING_COLS } from "@/lib/listings";

export function AdminListings() {
  const qc = useQueryClient();
  const { data: pending = [] } = useQuery({
    queryKey: ["admin-pending-listings"],
    queryFn: async () => (await supabase.from("listings").select(LISTING_COLS).eq("status", "pending").order("created_at")).data ?? [],
  });
  const { data: live = [] } = useQuery({
    queryKey: ["admin-live-listings"],
    queryFn: async () => (await supabase.from("listings").select(LISTING_COLS).eq("status", "approved").eq("is_sample", false).order("created_at", { ascending: false }).limit(30)).data ?? [],
  });
  const { data: reports = [] } = useQuery({
    queryKey: ["admin-reports"],
    queryFn: async () => (await supabase.from("reports").select("*, listings(title)").eq("resolved", false).order("created_at", { ascending: false })).data ?? [],
  });

  async function update(id: string, patch: { status?: string; details_reviewed?: boolean; sponsored?: boolean }) {
    const { error } = await supabase.from("listings").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing updated");
    qc.invalidateQueries({ queryKey: ["admin-pending-listings"] });
    qc.invalidateQueries({ queryKey: ["admin-live-listings"] });
  }
  async function resolve(id: string) {
    await supabase.from("reports").update({ resolved: true }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-reports"] });
  }

  const btn = "rounded-lg px-3 py-1.5 text-xs font-medium";
  return (
    <>
      <h2 className="mt-10 text-xl font-bold">Listings awaiting approval ({pending.length})</h2>
      <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-card">
        {pending.length === 0 && <p className="p-6 text-sm text-muted-foreground">Nothing to review.</p>}
        {pending.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div><Link to="/listings/$id" params={{ id: l.id }} className="font-medium hover:text-primary">{l.title}</Link>
              <div className="text-xs text-muted-foreground">{formatNaira(l.price)} · {l.city}, {l.state} · {l.category}</div></div>
            <div className="flex gap-2">
              <button onClick={() => update(l.id, { status: "approved" })} className={`${btn} bg-primary text-primary-foreground`}>Approve</button>
              <button onClick={() => update(l.id, { status: "approved", details_reviewed: true })} className={`${btn} border border-primary text-primary`}>Approve + details reviewed</button>
              <button onClick={() => update(l.id, { status: "rejected" })} className={`${btn} border border-destructive text-destructive`}>Reject</button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-bold">Reports ({reports.length})</h2>
      <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-card">
        {reports.length === 0 && <p className="p-6 text-sm text-muted-foreground">No open reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <div><Link to="/listings/$id" params={{ id: r.listing_id }} className="font-medium hover:text-primary">{r.listings?.title}</Link>
              <div className="text-xs text-muted-foreground">{r.reason.replace("_", " ")}{r.details ? ` — ${r.details}` : ""}</div></div>
            <div className="flex gap-2">
              <button onClick={() => update(r.listing_id, { status: "rejected" }).then(() => resolve(r.id))} className={`${btn} border border-destructive text-destructive`}>Take down</button>
              <button onClick={() => resolve(r.id)} className={`${btn} border border-border`}>Dismiss</button>
            </div>
          </div>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-bold">Live listings</h2>
      <div className="mt-3 divide-y divide-border rounded-xl bg-card shadow-card">
        {live.length === 0 && <p className="p-6 text-sm text-muted-foreground">No live member listings yet.</p>}
        {live.map((l) => (
          <div key={l.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 text-sm">
            <span className="font-medium">{l.title}</span>
            <button onClick={() => update(l.id, { sponsored: !l.sponsored })} className={`${btn} border border-border`}>{l.sponsored ? "Remove Sponsored" : "Mark Sponsored"}</button>
          </div>
        ))}
      </div>
    </>
  );
}
