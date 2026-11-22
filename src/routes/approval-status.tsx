import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Clock3, ShieldX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AuthScene } from "@/components/AuthScene";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/approval-status")({ component: ApprovalStatusPage });

function ApprovalStatusPage() {
  const { user } = useSession();
  const navigate = useNavigate();
  const { data: profile, isLoading } = useQuery({
    queryKey: ["approval-status", user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from("profiles")
        .select("account_type, approval_status, rejection_reason, is_blocked")
        .eq("id", user.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  useEffect(() => {
    if (!user) void navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    else if (profile?.approval_status === "approved" && !profile.is_blocked) void navigate({ to: "/", replace: true });
  }, [navigate, profile, user]);

  const blocked = profile?.is_blocked;
  const rejected = profile?.approval_status === "rejected";
  return <AuthScene>
        {isLoading || !profile ? <Clock3 className="mx-auto h-12 w-12 text-primary" /> : blocked || rejected ? <ShieldX className="mx-auto h-12 w-12 text-destructive" /> : <BadgeCheck className="mx-auto h-12 w-12 text-primary" />}
        <h1 className="mt-4 text-2xl font-bold">{isLoading || !profile ? "Checking your account…" : blocked ? "Account access paused" : rejected ? "Account not approved — Contact Support" : "Waiting for Admin Approval"}</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">{blocked
          ? "Your account is temporarily blocked. Contact RentReady Support for help."
          : rejected
            ? `Your profile was not approved${profile?.rejection_reason ? `: ${profile.rejection_reason}` : ""}. Contact RentReady Support if you need help.`
            : "We check every profile to stop fake accounts. You can browse listings while we review your account."}</p>
        {!blocked && !rejected && <p className="mt-2 text-xs text-muted-foreground">Messaging, favourites, viewings, listing, and paid features unlock after approval.</p>}
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Link to="/listings" className="rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground">Browse listings</Link>
          <Link to="/support" className="rounded-lg border border-border px-4 py-2.5 text-sm font-semibold">Contact Support</Link>
        </div>
        <button onClick={() => { void supabase.auth.signOut().then(() => navigate({ to: "/auth", search: { mode: "signin" }, replace: true })); }} className="mt-5 text-sm text-muted-foreground underline">Sign out</button>
  </AuthScene>;
}
