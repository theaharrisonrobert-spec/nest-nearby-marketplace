import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigins = new Set(["https://rentready-4g1.pages.dev", "http://localhost:5173", "http://127.0.0.1:5173"]);
const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": origin && allowedOrigins.has(origin) ? origin : "https://rentready-4g1.pages.dev",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

Deno.serve(async (request) => {
  const headers = corsHeaders(request.headers.get("origin"));
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...headers, "Content-Type": "application/json" } });
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackKey = Deno.env.get("PAYSTACK_SECRET_KEY");
  const planCode = Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE");
  const authorization = request.headers.get("Authorization");
  if (!url || !anonKey || !serviceKey || !paystackKey || !planCode || !authorization) return json({ error: "Tenant Premium checkout is not configured" }, 503);

  try {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user || !user.email) return json({ error: "Sign in with a verified email to continue" }, 401);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: profile, error: profileError } = await admin.from("profiles").select("account_type, approval_status, is_blocked").eq("id", user.id).maybeSingle();
    if (profileError || !profile) return json({ error: "Could not load your RentReady profile" }, 400);
    if (profile.approval_status !== "approved" || profile.is_blocked) return json({ error: "Your account must be approved before buying Tenant Premium" }, 403);
    if (profile.account_type !== "tenant") return json({ error: "Tenant Premium is available for tenant accounts" }, 403);
    const { data: active } = await admin.from("tenant_subscriptions").select("id")
      .eq("user_id", user.id).eq("status", "active").gt("current_period_end", new Date().toISOString()).limit(1).maybeSingle();
    if (active) return json({ error: "Tenant Premium is already active on your account" }, 409);

    const planResponse = await fetch(`https://api.paystack.co/plan/${encodeURIComponent(planCode)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });
    const planResult = await planResponse.json().catch(() => null);
    if (!planResponse.ok || !planResult?.status || planResult?.data?.amount !== 200000 || planResult?.data?.interval !== "monthly" || planResult?.data?.currency !== "NGN") {
      return json({ error: "The Tenant Premium Paystack plan must be configured as ₦2,000 NGN monthly" }, 503);
    }

    const reference = `RRTP-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
    const { error: insertError } = await admin.from("tenant_subscriptions").insert({
      user_id: user.id,
      email: user.email,
      paystack_reference: reference,
      plan: "tenant_premium",
      amount: 200000,
      status: "pending",
    });
    if (insertError) return json({ error: "Could not start your payment. Please try again." }, 500);

    const response = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: { Authorization: `Bearer ${paystackKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        email: user.email,
        amount: 200000,
        currency: "NGN",
        reference,
        plan: planCode,
        callback_url: "https://rentready-4g1.pages.dev/premium/callback",
        metadata: { user_id: user.id, plan: "tenant_premium" },
      }),
    });
    const initialized = await response.json().catch(() => null);
    if (!response.ok || initialized?.status !== true || typeof initialized?.data?.authorization_url !== "string") {
      await admin.from("tenant_subscriptions").update({ status: "failed" }).eq("paystack_reference", reference);
      return json({ error: initialized?.message ?? "Paystack could not initialize payment" }, 502);
    }
    return json({ authorization_url: initialized.data.authorization_url, reference });
  } catch (error) {
    console.error("Tenant Premium checkout error", error);
    return json({ error: "Could not start Tenant Premium checkout" }, 500);
  }
});
