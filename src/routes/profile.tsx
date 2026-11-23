import { createFileRoute, redirect } from "@tanstack/react-router";
import { ProfileSettingsPage } from "@/components/ProfileSettingsPage";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/profile")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth", search: { mode: "signin", next: location.pathname } });
    return { user: data.user };
  },
  component: ProfileRoute,
});

function ProfileRoute() {
  const { user } = Route.useRouteContext();
  return <ProfileSettingsPage user={user} />;
}
