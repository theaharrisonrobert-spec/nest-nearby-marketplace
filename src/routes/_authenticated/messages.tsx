import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export const Route = createFileRoute("/_authenticated/messages")({
  head: () => ({
    meta: [
      { title: "Messages — RentReady" },
      { name: "description", content: "Private property enquiries between owners, agents, buyers and tenants." },
      { property: "og:title", content: "Messages — RentReady" },
      { property: "og:description", content: "Private property enquiries." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

function Messages() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [active, setActive] = useState<string | null>(null);
  const [text, setText] = useState("");

  const { data: msgs = [] } = useQuery({
    queryKey: ["messages", user.id],
    refetchInterval: 15000,
    queryFn: async () => (await supabase.from("messages").select("*, listings(title)").order("created_at", { ascending: true })).data ?? [],
  });

  const threads = useMemo(() => {
    const m = new Map<string, { key: string; listingId: string; other: string; title: string; items: typeof msgs; unread: number }>();
    for (const x of msgs) {
      const other = x.sender_id === user.id ? x.recipient_id : x.sender_id;
      const key = `${x.listing_id}:${other}`;
      const t = m.get(key) ?? { key, listingId: x.listing_id, other, title: x.listings?.title ?? "Property", items: [], unread: 0 };
      t.items.push(x);
      if (x.recipient_id === user.id && !x.read_at) t.unread++;
      m.set(key, t);
    }
    return [...m.values()].reverse();
  }, [msgs, user.id]);
  const thread = threads.find((t) => t.key === active) ?? threads[0];

  useEffect(() => {
    if (!thread?.unread) return;
    const ids = thread.items.filter((x) => x.recipient_id === user.id && !x.read_at).map((x) => x.id);
    supabase.from("messages").update({ read_at: new Date().toISOString() }).in("id", ids).then(() => qc.invalidateQueries({ queryKey: ["unread"] }));
  }, [thread?.key, thread?.unread, user.id, qc]);

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!thread || !body) return;
    const { error } = await supabase.from("messages").insert({ listing_id: thread.listingId, sender_id: user.id, recipient_id: thread.other, body: body.slice(0, 2000) });
    if (error) { toast.error(error.message); return; }
    setText("");
    qc.invalidateQueries({ queryKey: ["messages"] });
  }

  return (
    <div className="min-h-screen bg-muted/40">
      <SiteHeader />
      <div className="mx-auto max-w-6xl px-5 py-8">
        <h1 className="text-3xl font-bold">Messages</h1>
        <p className="text-sm text-muted-foreground">Private conversations. Phone numbers stay hidden unless you choose to share them.</p>
        {threads.length === 0 ? (
          <div className="mt-6 rounded-xl bg-card p-10 text-center shadow-card">No messages yet. <Link to="/listings" className="text-primary">Find a property</Link> and send an enquiry.</div>
        ) : (
          <div className="mt-6 grid gap-4 md:grid-cols-[280px_1fr]">
            <ul className="h-fit divide-y divide-border rounded-xl bg-card shadow-card">
              {threads.map((t) => (
                <li key={t.key}>
                  <button onClick={() => setActive(t.key)} className={`w-full px-4 py-3 text-left text-sm ${thread?.key === t.key ? "bg-brand-soft" : "hover:bg-muted"}`}>
                    <div className="flex justify-between gap-2 font-medium"><span className="truncate">{t.title}</span>{t.unread > 0 && <span className="rounded-full bg-primary px-2 text-xs text-primary-foreground">{t.unread}</span>}</div>
                    <div className="truncate text-xs text-muted-foreground">{t.items[t.items.length - 1]?.body}</div>
                  </button>
                </li>
              ))}
            </ul>
            {thread && (
              <div className="flex flex-col rounded-xl bg-card shadow-card">
                <div className="border-b border-border px-5 py-3 font-semibold"><Link to="/listings/$id" params={{ id: thread.listingId }} className="hover:text-primary">{thread.title}</Link></div>
                <div className="flex-1 space-y-3 p-5">
                  {thread.items.map((x) => (
                    <div key={x.id} className={`max-w-[80%] rounded-xl px-4 py-2 text-sm ${x.sender_id === user.id ? "ml-auto bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <div className="whitespace-pre-line">{x.body}</div>
                      <div className="mt-1 text-[10px] opacity-70">{new Date(x.created_at).toLocaleString()}</div>
                    </div>
                  ))}
                </div>
                <form onSubmit={reply} className="flex gap-2 border-t border-border p-3">
                  <input value={text} onChange={(e) => setText(e.target.value)} maxLength={2000} placeholder="Write a reply…" className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary" />
                  <button className="rounded-lg bg-primary px-4 text-primary-foreground" aria-label="Send"><Send className="h-4 w-4" /></button>
                </form>
              </div>
            )}
          </div>
        )}
      </div>
      <SiteFooter />
    </div>
  );
}
