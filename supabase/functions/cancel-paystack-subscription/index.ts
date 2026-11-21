import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const url = Deno.env.get("SUPABASE_URL");
  const anon = Deno.env.get("SUPABASE_ANON_KEY");
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystack = Deno.env.get("PAYSTACK_SECRET_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anon || !service || !paystack || !authorization) return json({ error: "Subscription service is not configured" }, 503);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Sign in to manage your subscription" }, 401);
  let body: { plan?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (body.plan !== "landlord_premium" && body.plan !== "tenant_premium") return json({ error: "Only monthly plans can be cancelled here" }, 400);

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { data: subscription } = await admin.from("subscriptions").select("id, provider_subscription_code, provider_subscription_token, cancel_at_period_end, ends_at")
    .eq("user_id", authData.user.id).eq("plan", body.plan).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!subscription) return json({ error: "No active subscription was found" }, 404);
  if (subscription.cancel_at_period_end) return json({ cancelled: true, ends_at: subscription.ends_at });
  if (!subscription.provider_subscription_code || !subscription.provider_subscription_token) return json({ error: "Paystack has not returned subscription cancellation details yet. Try again shortly." }, 409);

  const response = await fetch("https://api.paystack.co/subscription/disable", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystack}`, "Content-Type": "application/json" },
    body: JSON.stringify({ code: subscription.provider_subscription_code, token: subscription.provider_subscription_token }),
  });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status) return json({ error: result?.message ?? "Paystack could not cancel renewal" }, 502);
  const { error } = await admin.from("subscriptions").update({ cancel_at_period_end: true }).eq("id", subscription.id);
  if (error) return json({ error: "Cancellation was sent, but RentReady could not update the plan status" }, 500);
  return json({ cancelled: true, ends_at: subscription.ends_at });
});
