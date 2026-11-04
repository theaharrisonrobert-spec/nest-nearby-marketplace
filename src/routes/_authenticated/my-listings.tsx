import { LISTING_COLS } from "@/lib/listings";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";
import { ListingCard } from "@/components/ListingCard";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/my-listings")({
  head: () => ({
    meta: [
      { title: "My Listings — RentReady" },
      { name: "description", content: "Manage the properties you posted on RentReady." },
      { property: "og:title", content: "My Listings — RentReady" },
      { property: "og:description", content: "Manage your posted properties." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MyListings,
});

function MyListings() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["my-listings", user.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("listings").select(LISTING_COLS).eq("owner_id", user.id).order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  async function remove(id: string) {
    if (!confirm("Remove this listing and its messages and viewing requests?")) return;
    const { error } = await supabase.from("listings").delete().eq("id", id).eq("owner_id", user.id);
    if (error) { toast.error(error.message); return; }
    toast.success("Listing removed");
    qc.invalidateQueries({ queryKey: ["my-listings"] });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-5 py-8">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">My Listings</h1>
          <Link to="/post" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">+ Post New</Link>
        </div>
        {isLoading ? <p className="mt-6 text-muted-foreground">Loading…</p> : !data?.length ? (
          <div className="mt-6 rounded-xl bg-card p-10 text-center shadow-card">
            <p className="font-semibold">You haven't posted anything yet.</p>
            <Link to="/post" className="mt-3 inline-block text-primary">Post your first property</Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {data.map((l) => (
              <div key={l.id}>
                <ListingCard l={l} />
                <div className="mt-2 flex items-center justify-between gap-2"><Button variant="outline" className="text-destructive" onClick={() => remove(l.id)}>Delete listing</Button><Button asChild variant="link"><Link to="/dashboard">Manage promotion</Link></Button></div>
              </div>
            ))}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
