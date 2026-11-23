import { BadgeCheck, Building2, ClipboardCheck, ShieldCheck } from "lucide-react";

const BADGES = {
  identity: { icon: BadgeCheck, label: "Verified identity", meaning: "We checked this person's government ID. This does not prove they own the property." },
  agency: { icon: Building2, label: "Verified agency", meaning: "We checked this agency's business registration." },
  reviewed: { icon: ClipboardCheck, label: "Details reviewed", meaning: "Our team reviewed the listing details. This is not a legal title check." },
};

export function TrustBadges({ identity, agency, reviewed, accountType, blueTick = false }: { identity: boolean; agency: boolean; reviewed: boolean; accountType?: string | null | undefined; blueTick?: boolean }) {
  const items = [identity && "identity", agency && accountType === "agent" && "agency", reviewed && "reviewed"].filter(Boolean) as (keyof typeof BADGES)[];
  if (!items.length && !blueTick) return <p className="mt-3 text-xs text-muted-foreground">No verification badges yet.</p>;
  return (
    <ul className="mt-3 space-y-2">
      {items.map((k) => {
        const B = BADGES[k];
        return (
          <li key={k} className="flex gap-2 text-sm">
            <B.icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <span><span className="font-medium">{B.label}</span><span className="block text-xs text-muted-foreground">{B.meaning}</span></span>
          </li>
        );
      })}
      {blueTick && <li className="flex gap-2 text-sm"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" /><span><span className="font-medium">Blue Tick</span><span className="block text-xs text-muted-foreground">Premium identity and live selfie review, currently active.</span></span></li>}
    </ul>
  );
}
