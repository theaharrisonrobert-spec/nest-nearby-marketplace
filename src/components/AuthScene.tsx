import { Link } from "@tanstack/react-router";
import { ArrowRight, Building2, House, LockKeyhole, Menu, ShieldCheck, UserRoundPlus, X } from "lucide-react";
import { useState } from "react";
import { Logo } from "@/components/SiteHeader";
import { Button } from "@/components/ui/button";
import residence from "@/assets/auth-residence.jpg";
import type { ReactNode } from "react";

export function AuthScene({ children }: { children: ReactNode }) {
  const [menu, setMenu] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <header className="relative z-20 border-b border-border bg-card">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <Logo />
          <nav aria-label="Main navigation" className="hidden items-center gap-8 text-sm font-semibold md:flex">
            <Link to="/" className="hover:text-primary">Home</Link>
            <Link to="/listings" className="hover:text-primary">Properties</Link>
            <Link to="/how-it-works" className="hover:text-primary">How It Works</Link>
            <Link to="/help" className="hover:text-primary">Help</Link>
          </nav>
          <Button asChild variant="outline" className="hidden rounded-full border-primary px-5 text-primary md:inline-flex">
            <Link to="/auth" search={{ mode: "signup" }}><UserRoundPlus /> Sign Up</Link>
          </Button>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label={menu ? "Close menu" : "Open menu"} onClick={() => setMenu(!menu)}>{menu ? <X /> : <Menu />}</Button>
        </div>
        {menu && <nav className="flex flex-wrap gap-5 border-t px-5 py-4 text-sm md:hidden" aria-label="Mobile navigation">
          <Link to="/">Home</Link><Link to="/listings">Properties</Link><Link to="/how-it-works">How It Works</Link><Link to="/help">Help</Link>
        </nav>}
      </header>
      <main className="auth-scene relative isolate">
        <img src={residence} width={1600} height={1024} alt="Modern apartments with illuminated balconies and landscaped gardens at dusk" className="absolute inset-0 -z-20 h-full w-full object-cover object-center" />
        <div className="absolute inset-0 -z-10 bg-hero-overlay" />
        <div className="mx-auto grid max-w-7xl items-center gap-9 px-5 py-9 sm:px-8 sm:py-12 lg:grid-cols-[1.25fr_1fr] lg:gap-16 lg:py-10">
          <section className="text-ink-foreground">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/90 px-4 py-2 text-sm font-semibold"><House className="h-5 w-5" /> Welcome to RentReady</div>
            <h1 className="mt-6 text-4xl font-bold leading-[1.08] sm:text-5xl lg:text-6xl">Your Trusted<br /><span className="text-auth-highlight">Property</span> Platform</h1>
            <p className="mt-5 max-w-md text-base font-medium leading-relaxed sm:text-lg">Find the perfect apartment for rent or sale, list your property and connect with buyers and tenants across Nigeria.</p>
            <div className="mt-7 flex flex-wrap gap-5 text-sm font-semibold sm:gap-7">
              {([[ShieldCheck, "Identity", "Checks"], [House, "Reviewed", "Listings"], [LockKeyhole, "Private", "Messaging"]] as const).map(([Icon, top, bottom]) => <div key={top} className="flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/90 text-auth-highlight"><Icon className="h-6 w-6" /></span><span>{top}<br />{bottom}</span></div>)}
            </div>
            <div className="mt-10 hidden items-center gap-4 border-l-4 border-auth-highlight bg-ink/85 px-5 py-5 lg:flex">
              <Building2 className="h-10 w-10 shrink-0 text-auth-highlight" />
              <div><h2 className="text-lg font-semibold">For Landlords</h2><p className="mt-1 text-sm text-ink-foreground/80">List your properties. Make your next connection.</p></div>
              <Button asChild variant="outline" className="ml-auto border-ink-foreground bg-transparent text-ink-foreground hover:bg-ink-foreground/10 hover:text-ink-foreground"><Link to="/post">List Your Property <ArrowRight /></Link></Button>
            </div>
          </section>
          <section aria-label="Account access" className="overflow-hidden rounded-lg bg-card text-card-foreground shadow-card">{children}</section>
        </div>
      </main>
      <div className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-5 text-xs text-muted-foreground"><span>© 2026 RentReady</span><Link to="/privacy">Privacy Policy</Link><Link to="/terms">Terms of Service</Link><Link to="/contact">Contact Us</Link></div>
    </div>
  );
}