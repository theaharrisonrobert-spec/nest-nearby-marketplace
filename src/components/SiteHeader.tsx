import { Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Home as HomeIcon, Menu, Plus, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

export function Logo({ light = false }: { light?: boolean }) {
  return (
    <Link to="/" className="flex items-center gap-2">
      <HomeIcon className="h-8 w-8 text-brand" strokeWidth={2.5} />
      <div className="leading-none">
        <div className={`font-display text-2xl font-bold ${light ? "text-ink-foreground" : "text-foreground"}`}>
          Rent<span className="text-brand">Ready</span>
        </div>
        <div className={`text-[11px] ${light ? "text-ink-foreground/70" : "text-muted-foreground"}`}>Find. Rent. Buy. Grow.</div>
      </div>
    </Link>
  );
}

const links = [
  { to: "/", label: "Home", search: {} },
  { to: "/listings", label: "Properties", search: {} },
  { to: "/listings", label: "Shops & Spaces", search: { category: "Shops" } },
  { to: "/listings", label: "Lagos", search: { state: "Lagos" } },
  { to: "/how-it-works", label: "How It Works", search: {} },
] as const;

export function SiteHeader({ overlay = false }: { overlay?: boolean }) {
  const [open, setOpen] = useState(false);
  const { user } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    await supabase.auth.signOut();
    navigate({ to: "/", replace: true });
  }

  const base = overlay ? "bg-ink/60 backdrop-blur border-ink-foreground/10" : "bg-ink border-ink-foreground/10";
  return (
    <header className={`relative z-20 border-b text-ink-foreground ${base}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Logo light />
        <nav className="hidden gap-7 text-sm lg:flex">
          {links.map((l) => (
            <Link key={l.label} to={l.to} search={l.search as never} className="text-ink-foreground/85 hover:text-brand">{l.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          <Link to="/post" className="flex items-center gap-1 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-foreground hover:opacity-90">
            <Plus className="h-4 w-4" /> Post a Property
          </Link>
          {user ? (
            <>
              <Link to="/my-listings" className="text-sm hover:text-brand">My Listings</Link>
              <button onClick={signOut} className="rounded-lg border border-ink-foreground/60 px-4 py-2 text-sm hover:bg-ink-foreground/10">Sign Out</button>
            </>
          ) : (
            <>
              <Link to="/auth" search={{ mode: "signin" }} className="rounded-lg border border-ink-foreground/60 px-4 py-2 text-sm hover:bg-ink-foreground/10">Sign In</Link>
              <Link to="/auth" search={{ mode: "signup" }} className="rounded-lg border border-brand px-4 py-2 text-sm text-brand hover:bg-brand/10">Sign Up</Link>
            </>
          )}
        </div>
        <button className="lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X /> : <Menu />}</button>
      </div>
      {open && (
        <div className="space-y-3 px-5 pb-5 lg:hidden">
          {links.map((l) => (
            <Link key={l.label} to={l.to} search={l.search as never} onClick={() => setOpen(false)} className="block text-ink-foreground/90">{l.label}</Link>
          ))}
          <Link to="/post" onClick={() => setOpen(false)} className="block rounded-lg bg-brand py-2 text-center text-sm font-medium text-brand-foreground">+ Post a Property</Link>
          {user ? (
            <div className="flex gap-3">
              <Link to="/my-listings" onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-ink-foreground/60 py-2 text-center text-sm">My Listings</Link>
              <button onClick={signOut} className="flex-1 rounded-lg border border-ink-foreground/60 py-2 text-sm">Sign Out</button>
            </div>
          ) : (
            <div className="flex gap-3">
              <Link to="/auth" search={{ mode: "signin" }} onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-ink-foreground/60 py-2 text-center text-sm">Sign In</Link>
              <Link to="/auth" search={{ mode: "signup" }} onClick={() => setOpen(false)} className="flex-1 rounded-lg border border-brand py-2 text-center text-sm text-brand">Sign Up</Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-ink text-ink-foreground">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-12 md:grid-cols-4">
        <div>
          <Logo light />
          <p className="mt-4 text-sm text-ink-foreground/70">Your Space. Your Choice. Your Next Move. No agents, no agency fees — talk directly to owners.</p>
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
          <div className="mb-3 font-semibold">Owners</div>
          <ul className="space-y-2 text-sm text-ink-foreground/70">
            <li><Link to="/post" className="hover:text-brand">Post a Property</Link></li>
            <li><Link to="/my-listings" className="hover:text-brand">My Listings</Link></li>
            <li><Link to="/auth" search={{ mode: "signup" }} className="hover:text-brand">Create Account</Link></li>
          </ul>
        </div>
      </div>
      <div className="border-t border-ink-foreground/10 py-5 text-center text-xs text-ink-foreground/60">© 2026 RentReady. All rights reserved.</div>
    </footer>
  );
}
