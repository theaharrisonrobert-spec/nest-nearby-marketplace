import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://rentready-4g1.pages.dev", "http://localhost:5173", "http://127.0.0.1:5173"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://rentready-4g1.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
});

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !paystackKey) return json({ error: "Subscription cancellation is not configured" }, 503);
  if (!authorization) return json({ error: "Sign in to cancel your subscription" }, 401);

  try {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session has expired. Sign in again." }, 401);
    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: row, error: rowError } = await admin.from("tenant_subscriptions")
      .select("id, paystack_subscription_code, paystack_subscription_token, cancel_at_period_end, current_period_end")
      .eq("user_id", user.id).eq("status", "active").gt("current_period_end", new Date().toISOString())
      .order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (rowError || !row) return json({ error: "No active Tenant Premium subscription was found" }, 404);
    if (row.cancel_at_period_end) return json({ cancelled: true, current_period_end: row.current_period_end });
    if (!row.paystack_subscription_code || !row.paystack_subscription_token) return json({ error: "Paystack has not provided the renewal cancellation details yet. Try again shortly." }, 409);

    const response = await fetch("https://api.paystack.co/subscription/disable", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: row.paystack_subscription_code, token: row.paystack_subscription_token }),
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || result?.status !== true) return json({ error: result?.message ?? "Paystack could not cancel renewal" }, 502);
    const { error: updateError } = await admin.from("tenant_subscriptions").update({ cancel_at_period_end: true, updated_at: new Date().toISOString() }).eq("id", row.id);
    if (updateError) return json({ error: "Paystack accepted cancellation, but RentReady could not update your subscription" }, 500);
    return json({ cancelled: true, current_period_end: row.current_period_end });
  } catch (error) {
    console.error("Tenant Premium cancellation error", error);
    return json({ error: "Could not cancel Tenant Premium renewal" }, 500);
  }
});
