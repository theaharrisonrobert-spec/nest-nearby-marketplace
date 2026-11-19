import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, Home as HomeIcon, Menu, User, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/listings";

export function Logo({ light = false }: { light?: boolean }) {
  return <Link to="/" className="flex items-center gap-2"><HomeIcon className="h-7 w-7 text-primary" strokeWidth={2.5} /><span className={`font-display text-2xl font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>Rent<span className="text-primary">Ready</span></span></Link>;
}

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: profile } = useQuery({
    queryKey: ["account-menu-profile", user?.id], enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, account_type, verification_status").eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: isAdmin } = useQuery({
    queryKey: ["account-menu-admin", user?.id], enabled: !!user,
    queryFn: async () => user ? (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data : false,
  });
  useEffect(() => {
    if (!open && !account) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setAccount(false); } };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = previous; window.removeEventListener("keydown", close); };
  }, [open, account]);
  async function signOut() {
    setAccount(false); setOpen(false);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }
  const close = () => { setOpen(false); setAccount(false); };
  return <>
    <header className={`relative z-40 border-b border-border ${overlay ? "bg-transparent text-ink-foreground" : "bg-card text-card-foreground"}`}>
      <div className="mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5">
        <Button variant="ghost" size="icon" className="justify-self-start" aria-label="Open menu" onClick={() => { setOpen(true); setAccount(false); }}><Menu /></Button>
        <Logo light={overlay} />
        {user ? <Button variant="ghost" size="icon" className="justify-self-end rounded-full bg-primary text-primary-foreground hover:bg-primary/90" aria-label="My account" onClick={() => { setAccount(!account); setOpen(false); }}><User /></Button> : <Button asChild variant="link" className={`justify-self-end px-0 ${overlay ? "text-ink-foreground" : "text-primary"}`}><Link to="/auth" search={{ mode: "signin" }}>Sign in</Link></Button>}
      </div>
    </header>
    {open && <div role="dialog" aria-modal="true" aria-label="Navigation menu" className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-5"><Button variant="outline" size="icon" aria-label="Close menu" onClick={close}><X /></Button><Logo /><span /></div>
      <nav className="mx-auto max-w-4xl" aria-label="Property navigation">
        <Link to="/listings" search={{ purpose: "sale" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Buy</Link>
        <Link to="/listings" search={{ purpose: "rent" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Rent</Link>
        <details className="group border-b border-border"><summary className="flex min-h-20 cursor-pointer list-none items-center justify-between px-6 text-xl">Property types<ChevronDown className="h-6 w-6 text-primary group-open:rotate-180" /></summary><div className="grid gap-4 bg-muted/40 px-6 py-5 sm:grid-cols-2">{CATEGORIES.map(c => <Link key={c.name} to="/listings" search={{ category: c.name }} onClick={close}>{c.name}</Link>)}</div></details>
        <Link to="/post" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">List your property</Link>
        <Link to="/dashboard" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Manage listings & promotions</Link>
        <Link to="/how-it-works" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">How it works</Link>
        <Link to="/help" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Get help</Link>
        {!user && <div className="grid gap-4 px-6 py-6"><Link to="/auth" search={{ mode: "signup", type: "landlord" }} onClick={close}>Landlord sign up</Link><Link to="/auth" search={{ mode: "signup", type: "tenant" }} onClick={close}>Buyer / Tenant sign up</Link></div>}
      </nav>
    </div>}
    {account && user && <div className="fixed inset-0 z-50 bg-ink/30" onClick={close}><section role="dialog" aria-modal="true" aria-label="Account menu" onClick={e => e.stopPropagation()} className="absolute inset-x-0 top-20 mx-auto max-w-lg rounded-lg bg-card px-5 py-4 text-card-foreground shadow-card">
      <div className="flex items-center justify-between border-b border-border pb-3"><div><p className="font-semibold">{profile?.full_name || "My account"}</p>{profile?.verification_status === "approved" && <span className="mt-1 flex items-center gap-1 text-sm text-primary"><BadgeCheck className="h-4 w-4" />Verified identity</span>}</div><Button variant="ghost" size="icon" aria-label="Close account menu" onClick={close}><X /></Button></div>
      <Link to="/dashboard" onClick={close} className="block py-4 text-lg font-semibold">Your dashboard</Link>
      {profile?.account_type === "landlord" && <><Link to="/my-listings" onClick={close} className="block py-4 text-lg font-semibold">Your listings</Link><Link to="/dashboard" onClick={close} className="block border-b border-border py-4 text-lg font-semibold">Promote your listing</Link></>}
      <Link to="/dashboard" onClick={close} className="block py-4 text-lg font-semibold">Tours & viewings</Link><Link to="/messages" onClick={close} className="block border-b border-border py-4 text-lg font-semibold">Inbox</Link>
      <Link to="/verify" onClick={close} className="block py-4 text-lg font-semibold">{profile?.verification_status === "approved" ? "Identity verified" : "Identity verification"}</Link>
      {isAdmin && <Link to="/admin" onClick={close} className="block py-4 text-lg font-semibold">Admin dashboard</Link>}
      <Button variant="ghost" onClick={signOut} className="h-14 w-full justify-start border-t border-border px-0 text-lg font-semibold">Sign out</Button>
    </section></div>}
  </>;
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm text-ink-foreground/70">Your Space. Your Choice. Your Next Move. Connecting Properties, People, and Opportunities.</p>
        </div>
        <div>
          <div className="mb-3 font-semibold">Explore</div>
          <ul className="space-y-2 text-sm text-ink-foreground/70">
            <li><Link to="/listings" className="hover:text-brand">All Properties</Link></li>
            <li><Link to="/listings" search={{ purpose: "rent" }} className="hover:text-brand">For Rent</Link></li>
            <li><Link to="/listings" search={{ purpose: "sale" }} className="hover:text-brand">For Sale</Link></li>
            <li><Link to="/how-it-works" className="hover:text-brand">How It Works</Link></li>
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold">Popular in Nigeria</div>
          <ul className="space-y-2 text-sm text-ink-foreground/70">
            {["Lagos", "Abuja", "Rivers", "Oyo", "Ogun"].map((s) => (
              <li key={s}><Link to="/listings" search={{ state: s }} className="hover:text-brand">Properties in {s}</Link></li>
            ))}
          </ul>
        </div>
        <div>
          <div className="mb-3 font-semibold">Support</div>
          <ul className="space-y-2 text-sm text-ink-foreground/70">
            <li><Link to="/landlords" className="hover:text-brand">For Landlords</Link></li>
            <li><Link to="/help" className="hover:text-brand">Help Centre & FAQs</Link></li>
            <li><Link to="/contact" className="hover:text-brand">Contact Us</Link></li>
            <li><Link to="/privacy" className="hover:text-brand">Privacy Policy</Link></li>
            <li><Link to="/terms" className="hover:text-brand">Terms of Service</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/60">© 2026 RentReady. All rights reserved.</div>
    </footer>
  );
}
// rebuild
