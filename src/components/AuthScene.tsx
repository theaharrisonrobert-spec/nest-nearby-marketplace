import { Logo } from "@/components/SiteHeader";
import type { ReactNode } from "react";

export function AuthScene({ children }: { children: ReactNode }) {
  return (
    <div className="relative isolate flex min-h-screen flex-col bg-[#f7f8f7] text-foreground">
      <header className="relative z-10 border-b border-border bg-white sm:border-0 sm:bg-transparent">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-center px-5 sm:h-20"><Logo homeMark /></div>
      </header>
      <main aria-label="Account access" className="relative z-10 mx-auto flex w-full max-w-[480px] flex-1 items-center px-4 py-5 sm:px-5 sm:py-8">
        <div className="w-full rounded-3xl bg-white p-6 shadow-[0_16px_48px_rgba(15,23,42,0.12)] sm:p-9">{children}</div>
      </main>
      <footer className="relative z-10 mx-auto flex max-w-6xl flex-wrap justify-center gap-x-5 gap-y-2 px-5 py-6 text-xs text-muted-foreground">
        <span>© 2026 RentReady</span><a href="/privacy">Privacy Policy</a><a href="/terms">Terms of Use</a><a href="/contact">Contact</a>
      </footer>
    </div>
  );
}
