import { Logo } from "@/components/SiteHeader";
import type { ReactNode } from "react";

export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-background text-foreground">
      <header className="relative z-10 border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center px-5"><Logo homeMark /></div>
      </header>
      <main aria-label="Account access" className="relative z-10 mx-auto flex w-full max-w-[440px] flex-1 items-center px-5 py-10 sm:py-14">
        <div className="w-full rounded-2xl bg-white p-6 shadow-2xl sm:p-8">{children}</div>
      </main>
      <footer className="relative z-10 mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-xs text-muted-foreground">
        <span>© 2026 RentReady</span><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/contact">Contact</a>
      </footer>
    </div>
  );
}
