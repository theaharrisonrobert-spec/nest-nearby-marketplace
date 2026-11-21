import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin", next: location.pathname } });
    if (data.user.email?.toLowerCase() === "rentreadyng@gmail.com") return { user: data.user };
    const { data: profile, error: profileError } = await supabase.from("profiles").select("approval_status, is_blocked").eq("id", data.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.is_blocked || profile.approval_status !== "approved") throw redirect({ to: "/approval-status", replace: true });
    return { user: data.user };
  },
  component: () => <Outlet />,
});
