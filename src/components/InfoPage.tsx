import type { ReactNode } from "react";
import { SiteHeader, SiteFooter } from "@/components/SiteHeader";

export function InfoPage({ title, intro, children }: { title: string; intro?: string; children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <div className="mx-auto max-w-3xl px-5 py-14">
        <h1 className="text-4xl font-bold">{title}</h1>
        {intro && <p className="mt-3 text-lg text-muted-foreground">{intro}</p>}
        <div className="prose-rr mt-8 space-y-6 leading-relaxed text-foreground/85 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-foreground [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">{children}</div>
      </div>
      <SiteFooter />
    </div>
  );
}

export function meta(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — RentReady` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — RentReady` },
      { property: "og:description", content: description },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary" },
    ],
  };
}
