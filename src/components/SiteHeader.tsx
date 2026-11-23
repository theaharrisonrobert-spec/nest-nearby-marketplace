import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart, Home as HomeIcon, Menu, MessageSquare, Search, UserRound, X } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";
import { Button } from "@/components/ui/button";
import { getActiveMobileTab } from "@/lib/mobile-navigation";

export function Logo({ light = false, homeMark = false }: { light?: boolean; homeMark?: boolean }) {
  return homeMark
    ? <Link to="/" className="flex shrink-0 items-center gap-2"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-white"><HomeIcon className="h-6 w-6" strokeWidth={2.5} /></span><span className="font-display text-2xl font-bold text-primary">RentReady</span></Link>
    : <Link to="/" className="flex items-center gap-2"><HomeIcon className="h-7 w-7 text-primary" strokeWidth={2.5} /><span className={"font-display text-2xl font-bold " + (light ? "text-ink-foreground" : "text-foreground")}>Rent<span className="text-primary">Ready</span></span></Link>;
}

export function SiteHeader({ overlay = false, home = false }: { overlay?: boolean; home?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeMobileTab = getActiveMobileTab(pathname);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: unreadMessages = 0 } = useQuery({
    queryKey: ["unread", user?.id],
    enabled: !!user,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!user) return 0;
      const { count, error } = await supabase.from("messages").select("id", { count: "exact", head: true })
        .eq("recipient_id", user.id).is("read_at", null);
      if (error) throw error;
      return count ?? 0;
    },
  });
  const { data: headerProfile } = useQuery({
    queryKey: ["profile-header", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles").select("full_name, avatar_url, account_type, professional_type").eq("id", user.id).maybeSingle();
      if (error) throw error;
      if (!data?.avatar_url) return { fullName: data?.full_name ?? null, avatarUrl: null, accountType: data?.account_type ?? null, professionalType: data?.professional_type ?? null };
      const { data: signed, error: signedError } = await supabase.storage.from("profile-photos").createSignedUrl(data.avatar_url, 60 * 60);
      if (signedError) throw signedError;
      return { fullName: data.full_name, avatarUrl: signed.signedUrl, accountType: data.account_type, professionalType: data.professional_type };
    },
  });
  const { data: isAdmin = false } = useQuery({
    queryKey: ["home-greeting-admin", user?.id],
    enabled: home && !!user,
    queryFn: async () => user ? (await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" })).data ?? false : false,
  });
  useEffect(() => {
    if (!open) {
      document.body.style.overflow = "";
      return;
    }
    document.body.style.overflow = "hidden";
    const close = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", close);
    return () => { document.body.style.overflow = ""; window.removeEventListener("keydown", close); };
  }, [open]);
  async function signOut() {
    setOpen(false);
    await qc.cancelQueries(); qc.clear();
    await supabase.auth.signOut();
    await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
  }
  const close = () => setOpen(false);
  const headerInitial = (headerProfile?.fullName?.trim() || (typeof user?.user_metadata?.full_name === "string" ? user.user_metadata.full_name : "") || user?.email || "?").charAt(0).toUpperCase();
  return <>
    <header className={(home ? "sticky top-0" : "relative") + " z-40 border-b border-border " + (home ? "bg-white text-foreground shadow-sm" : overlay ? "bg-transparent text-ink-foreground" : "bg-card text-card-foreground")}>
      <div className={home ? "mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-5" : "mx-auto grid h-20 max-w-7xl grid-cols-[1fr_auto_1fr] items-center px-5"}>
        <Button variant="ghost" size="icon" className={home ? "lg:hidden" : "justify-self-start"} aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></Button>
        <Logo light={overlay && !home} homeMark={home} />
        {home && <nav className="hidden items-center gap-5 lg:flex" aria-label="Main navigation">
          <Link to="/" className="text-sm font-medium hover:text-primary">Home</Link>
          <Link to="/listings" search={{ purpose: "sale" }} className="text-sm font-medium hover:text-primary">Buy</Link>
          <Link to="/listings" search={{ purpose: "rent" }} className="text-sm font-medium hover:text-primary">Rent</Link>
          <Link to="/listings" search={{ purpose: "short-let" }} className="text-sm font-medium hover:text-primary">Short Let</Link>
        </nav>}
        <div className={(home ? "ml-auto flex items-center gap-2 sm:gap-4" : "justify-self-end") + " relative"}>
          {home && <Link to="/saved" aria-label="Saved properties" className="hidden text-primary sm:inline-flex"><Heart className="h-5 w-5" /></Link>}
          {user ? <Link to="/profile" aria-label="Profile" className="box-border flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full border-2 border-primary bg-primary text-primary-foreground lg:h-10 lg:w-10">
            {headerProfile?.avatarUrl ? <img src={headerProfile.avatarUrl} alt="" className="h-full w-full object-cover" /> : <span className="text-base font-bold">{headerInitial}</span>}
          </Link> : <Button asChild variant="link" className={home ? "text-foreground" : "justify-self-end px-0 " + (overlay ? "text-ink-foreground" : "text-primary")}><Link to="/auth" search={{ mode: "signin" }}>Sign in</Link></Button>}
          {home && (user ? isAdmin || headerProfile?.accountType === "landlord" ? <Button asChild className="hidden bg-primary text-white hover:bg-primary/90 sm:inline-flex"><Link to="/post">+ Post Property</Link></Button> : headerProfile?.accountType === "tenant" ? <Button asChild className="hidden bg-primary text-white hover:bg-primary/90 sm:inline-flex"><Link to="/settings" hash="account-type">Become a Landlord to Post</Link></Button> : null : <Button asChild className="hidden bg-primary text-white hover:bg-primary/90 sm:inline-flex"><Link to="/auth" search={{ mode: "signup", type: "landlord" }}>Post Property</Link></Button>)}
        </div>
      </div>
    </header>
    {open && <div role="dialog" aria-modal="true" aria-label="Navigation menu" className="fixed inset-0 z-50 overflow-y-auto bg-background text-foreground">
      <div className="grid h-20 grid-cols-[1fr_auto_1fr] items-center border-b border-border px-5"><Button variant="outline" size="icon" aria-label="Close menu" onClick={close}><X /></Button><Logo /><span /></div>
      <nav className="mx-auto max-w-4xl" aria-label="More navigation">
        <Link to="/settings" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Settings</Link>
        <Link to="/help" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">Help / Support</Link>
        <Link to="/about" onClick={close} className="flex min-h-20 items-center border-b border-border px-6 text-xl">About</Link>
        {user && <button type="button" onClick={() => void signOut()} className="flex min-h-20 w-full items-center border-b border-border px-6 text-left text-xl">Log out</button>}
      </nav>
    </div>}
    <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-30 grid h-16 grid-cols-5 border-t border-border bg-white/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_18px_rgba(26,26,26,0.08)] backdrop-blur lg:hidden">
      <Link to="/" aria-current={activeMobileTab === "home" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "home" ? "text-primary" : "text-muted-foreground"}`}><HomeIcon className="h-5 w-5" />Home</Link>
      <Link to="/listings" aria-current={activeMobileTab === "search" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "search" ? "text-primary" : "text-muted-foreground"}`}><Search className="h-5 w-5" />Search</Link>
      <Link to="/saved" aria-current={activeMobileTab === "saved" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "saved" ? "text-primary" : "text-muted-foreground"}`}><Heart className="h-5 w-5" />Saved</Link>
      <Link to="/messages" aria-current={activeMobileTab === "messages" ? "page" : undefined} aria-label={unreadMessages > 0 ? `Messages, ${unreadMessages} unread` : "Messages"} className={`relative flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "messages" ? "text-primary" : "text-muted-foreground"}`}><MessageSquare className="h-5 w-5" />Messages{unreadMessages > 0 && <span aria-hidden="true" className="absolute right-1/4 top-1 h-2.5 w-2.5 rounded-full bg-destructive ring-2 ring-white" />}</Link>
      <Link to="/profile" aria-current={activeMobileTab === "profile" ? "page" : undefined} className={`flex flex-col items-center justify-center gap-1 text-xs font-medium ${activeMobileTab === "profile" ? "text-primary" : "text-muted-foreground"}`}><UserRound className="h-5 w-5" />Profile</Link>
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
