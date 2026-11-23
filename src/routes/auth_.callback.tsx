import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthScene } from "@/components/AuthScene";

export const Route = createFileRoute("/auth_/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const started = useRef(false);
  const message = "Please wait while we confirm your email and finish signing you in.";

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    async function continueWithSession(userId: string) {
      const { data: authData } = await supabase.auth.getUser();
      if (authData.user?.email?.toLowerCase() === "rentreadyng@gmail.com") {
        window.history.replaceState(window.history.state, "", window.location.pathname);
        await navigate({ to: "/", replace: true });
        return;
      }
      const { data: profile, error } = await supabase.from("profiles")
        .select("account_type, role_selected, approval_status, is_blocked").eq("id", userId).maybeSingle();
      if (error) throw error;

      window.history.replaceState(window.history.state, "", window.location.pathname);
      if (!profile || !profile.role_selected) {
        await navigate({ to: "/auth", search: { mode: "signup", googleRole: true }, replace: true });
        return;
      }
      if (profile.is_blocked || profile.approval_status !== "approved") {
        await navigate({ to: "/", replace: true });
        return;
      }
      await navigate({ to: "/", replace: true });
    }

    async function completeSignIn() {
      const callbackUrl = new URL(window.location.href);
      const code = callbackUrl.searchParams.get("code");
      const hashParams = new URLSearchParams(callbackUrl.hash.replace(/^#/, ""));
      const oauthError = callbackUrl.searchParams.get("error_description")
        ?? callbackUrl.searchParams.get("error")
        ?? hashParams.get("error_description")
        ?? hashParams.get("error");

      const clearCallbackParams = () => {
        window.history.replaceState(window.history.state, "", callbackUrl.pathname);
      };
      if (oauthError) throw new Error(oauthError);

      const { data: current, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;
      if (current.session) {
        await continueWithSession(current.session.user.id);
        return;
      }

      if (!code) throw new Error("No confirmation code was returned. Request a new email link and try again.");

      const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
      if (exchangeError) {
        const { data: latest, error: recheckError } = await supabase.auth.getSession();
        if (recheckError) throw recheckError;
        if (latest.session) {
          await continueWithSession(latest.session.user.id);
          return;
        }
        throw exchangeError;
      }
      if (!data.session) throw new Error("Google sign-in finished without creating a session.");
      await continueWithSession(data.session.user.id);
    }

    void completeSignIn().catch(async (reason: unknown) => {
      clearCallbackParams();
      sessionStorage.setItem("rr-auth-error", reason instanceof Error ? reason.message : "Email confirmation or sign-in could not be completed.");
      await navigate({ to: "/auth", search: { mode: "signin" }, replace: true });
    });

    function clearCallbackParams() {
      window.history.replaceState(window.history.state, "", window.location.pathname);
    }
  }, [navigate]);

  return <AuthScene>
    <div className="text-center">
      <h1 className="text-2xl font-bold text-foreground">Confirming your account…</h1>
      <p role="status" className="mt-2 text-sm text-muted-foreground">{message}</p>
      <Link to="/" className="mt-5 inline-block text-sm font-semibold text-primary hover:underline">Return home</Link>
    </div>
  </AuthScene>;
}
