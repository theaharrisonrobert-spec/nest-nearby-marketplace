import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BadgeCheck, ChevronDown, Heart, Home as HomeIcon, Menu, Search, Settings as SettingsIcon, User, UserRound, X, MessageSquare } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { CATEGORIES } from "@/lib/listings";
import { getActiveMobileTab } from "@/lib/mobile-navigation";

export function Logo({ light = false, homeMark = false }: { light?: boolean; homeMark?: boolean }) {
  return homeMark
    ? <Link to="/" className="flex shrink-0 items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><HomeIcon className="h-6 w-6" strokeWidth={2.5} /></span><span className="font-display text-2xl font-bold text-primary">RentReady</span></Link>
    : <Link to="/" className="flex items-center gap-2"><HomeIcon className="h-7 w-7 text-primary" strokeWidth={2.5} /><span className={"font-display text-2xl font-bold " + (light ? "text-ink-foreground" : "text-foreground")}>Rent<span className="text-primary">Ready</span></span></Link>;
}

export function SiteHeader({ overlay = false, home = false }: { overlay?: boolean; home?: boolean }) {
  const [open, setOpen] = useState(false);
  const [account, setAccount] = useState(false);
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeMobileTab = getActiveMobileTab(pathname);
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
    if (!open && !account) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") { setOpen(false); setAccount(false); } };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [open, account]);
  async function signOut() {
    setAccount(false); setOpen(false);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }
  const close = () => { setOpen(false); setAccount(false); };
  return <>
    <header className={(home ? "sticky top-0" : "relative") + " z-40 border-b border-border " + (home ? "bg-white text-foreground shadow-sm" : overlay ? "bg-transparent text-ink-foreground" : "bg-card text-card-foreground")}>
      <div className={home ? "mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-5" : "mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5"}>
        <Button variant="ghost" size="icon" className={home ? "lg:hidden" : "justify-self-start"} aria-label="Open menu" onClick={() => { setOpen(true); setAccount(false); }}><Menu /></Button>
        <Logo light={overlay && !home} homeMark={home} />
        {home && <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation">
          <Link to="/" className="text-sm font-medium hover:text-primary">Home</Link>
          <Link to="/listings" search={{ purpose: "sale" }} className="text-sm font-medium hover:text-primary">Buy</Link>
          <Link to="/listings" search={{ purpose: "rent" }} className="text-sm font-medium hover:text-primary">Rent</Link>
          <Link to="/listings" search={{ purpose: "short-let" }} className="text-sm font-medium hover:text-primary">Short Let</Link>
          <Link to="/landlords" className="text-sm font-medium hover:text-primary">Agents</Link>
        </nav>}
        <div className={(home ? "ml-auto flex items-center gap-2 sm:gap-4" : "justify-self-end") + " relative"}>
          {home && <Link to="/listings" aria-label="Saved properties" className="hidden text-primary sm:inline-flex"><Heart className="h-5 w-5" /></Link>}
          {user ? <Button variant="ghost" size="icon" className={"rounded-full bg-primary text-primary-foreground hover:bg-primary/90 " + (home ? "" : "justify-self-end")} aria-label="My account" aria-expanded={account} onClick={() => { setAccount(!account); setOpen(false); }}><User /></Button> : <Button asChild variant="link" className={home ? "text-foreground" : "justify-self-end px-0 " + (overlay ? "text-ink-foreground" : "text-primary")}><Link to="/auth" search={{ mode: "signin" }}>Sign in</Link></Button>}
          {home && <Button asChild className="hidden bg-primary text-white hover:bg-primary/90 sm:inline-flex"><Link to="/post">Post Property</Link></Button>}
          {account && user && <section role="menu" aria-label="Account menu" className="absolute right-0 top-14 z-50 max-h-[calc(100dvh-6rem)] w-72 overflow-y-auto rounded-xl border border-border bg-card p-3 text-card-foreground shadow-card">
            <div className="border-b border-border px-2 pb-3"><p className="font-semibold">{profile?.full_name || "My account"}</p>{profile?.verification_status === "approved" && <span className="mt-1 flex items-center gap-1 text-sm text-primary"><BadgeCheck className="h-4 w-4" />Verified identity</span>}</div>
            <Link role="menuitem" to="/profile" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Profile</Link>
            <Link role="menuitem" to="/settings" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Settings</Link>
            <Link role="menuitem" to="/dashboard" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Your dashboard</Link>
            {profile?.account_type === "landlord" && <><Link role="menuitem" to="/my-listings" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Your listings</Link><Link role="menuitem" to="/dashboard" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Promote your listing</Link></>}
            <Link role="menuitem" to="/dashboard" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Tours & viewings</Link>
            <Link role="menuitem" to="/messages" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Inbox</Link>
            <Link role="menuitem" to="/verify" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">{profile?.verification_status === "approved" ? "Identity verified" : "Identity verification"}</Link>
            {isAdmin && <Link role="menuitem" to="/admin" onClick={close} className="block rounded-lg px-3 py-3 font-semibold hover:bg-muted">Admin dashboard</Link>}
            <Button role="menuitem" variant="ghost" onClick={signOut} className="h-12 w-full justify-start px-3 font-semibold">Log out</Button>
          </section>}
        </div>
      </div>
    </header>
    {open && <div role="dialog" aria-modal="true" aria-label="Navigation menu" className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-5"><Button variant="outline" size="icon" aria-label="Close menu" onClick={close}><X /></Button><Logo /><span /></div>
      <nav className="mx-auto max-w-4xl" aria-label="Property navigation">
        <Link to="/" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Home</Link>
        <Link to="/listings" search={{ purpose: "sale" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Buy</Link>
        <Link to="/listings" search={{ purpose: "rent" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Rent</Link>
        <Link to="/listings" search={{ purpose: "short-let" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Short Let</Link>
        <Link to="/landlords" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Agents</Link>
        <Link to="/post" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Post Property</Link>
        {!user ? <Link to="/auth" search={{ mode: "signin" }} onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Sign in</Link> : <><Link to="/profile" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Profile</Link><Link to="/settings" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Settings</Link><Link to="/dashboard" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">My account</Link></>}
        <details className="group border-b border-border"><summary className="flex min-h-20 cursor-pointer list-none items-center justify-between px-6 text-xl">Browse by property type<ChevronDown className="h-6 w-6 text-primary group-open:rotate-180" /></summary><div className="grid gap-4 bg-muted/40 px-6 py-5 sm:grid-cols-2">{CATEGORIES.map(c => <Link key={c.name} to="/listings" search={{ category: c.name }} onClick={close}>{c.name}</Link>)}</div></details>
      </nav>
    </div>}
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(26,26,26,0.08)] backdrop-blur lg:hidden">
      <Link to="/" aria-current={activeMobileTab === "home" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "home" ? "text-primary" : "text-muted-foreground"}`}><HomeIcon className="h-5 w-5" />Home</Link>
      <Link to="/listings" aria-current={activeMobileTab === "search" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "search" ? "text-primary" : "text-muted-foreground"}`}><Search className="h-5 w-5" />Search</Link>
      <Link to="/messages" aria-current={activeMobileTab === "messages" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "messages" ? "text-primary" : "text-muted-foreground"}`}><MessageSquare className="h-5 w-5" />Messages</Link>
      <Link to="/profile" aria-current={activeMobileTab === "profile" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "profile" ? "text-primary" : "text-muted-foreground"}`}><UserRound className="h-5 w-5" />Profile</Link>
      <Link to="/settings" aria-current={activeMobileTab === "settings" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "settings" ? "text-primary" : "text-muted-foreground"}`}><SettingsIcon className="h-5 w-5" />Settings</Link>
    </nav>
  </>;
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 pt-12 pb-28 md:grid-cols-4 md:py-12">
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
      <div className="border-t border-ink-foreground/10 px-5 pt-5 pb-24 text-center text-xs text-ink-foreground/60 md:py-5">© 2026 RentReady.ng All rights reserved.</div>
    </footer>
  );
}
// rebuild
