import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const prices = {
  landlord_premium: 5000,
  tenant_premium: 2000,
  blue_tick_monthly: 10000,
  boost_post: 5000,
} as const;
type Plan = keyof typeof prices;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const paystackSecret = Deno.env.get("PAYSTACK_SECRET_KEY");
  if (!supabaseUrl || !anonKey || !serviceKey || !paystackSecret) return json({ error: "Payment service is not configured" }, 503);

  const authorization = request.headers.get("Authorization");
  if (!authorization) return json({ error: "Sign in to continue" }, 401);
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ error: "Your session has expired. Sign in again." }, 401);

  let body: { plan?: Plan; listing_id?: string };
  try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
  if (!body.plan || !(body.plan in prices)) return json({ error: "Choose a valid RentReady plan" }, 400);
  const plan = body.plan;
  const service = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: profile, error: profileError } = await service.from("profiles").select("account_type, verification_status, verification_name_matched, approval_status, is_blocked, blue_tick_status").eq("id", authData.user.id).maybeSingle();
  if (profileError || !profile) return json({ error: "Could not load your RentReady profile" }, 400);
  if (profile.is_blocked || profile.approval_status !== "approved") return json({ error: "Your account must be approved before making this payment" }, 403);
  if (plan === "landlord_premium" && profile.account_type !== "landlord") return json({ error: "Landlord Premium is for landlord accounts" }, 403);
  if (plan === "tenant_premium" && profile.account_type !== "tenant") return json({ error: "Tenant Premium is for tenant accounts" }, 403);
  if (plan === "blue_tick_monthly" && (profile.account_type !== "landlord" || profile.verification_status !== "approved" || !profile.verification_name_matched)) return json({ error: "Complete free ID verification before applying for Blue Tick" }, 403);
  if (plan === "blue_tick_monthly" && profile.blue_tick_status === "approved") {
    const { data: activeBlueTick } = await service.from("subscriptions").select("id").eq("user_id", authData.user.id)
      .eq("plan", "blue_tick_monthly").eq("status", "active").gt("ends_at", new Date().toISOString()).limit(1).maybeSingle();
    if (activeBlueTick) return json({ error: "Blue Tick is already active on this account" }, 409);
  }

  if (plan === "boost_post") {
    if (!body.listing_id) return json({ error: "Choose the property to feature" }, 400);
    const { data: listing } = await service.from("listings").select("id, status, owner_id, boosted_until").eq("id", body.listing_id).maybeSingle();
    if (!listing || listing.owner_id !== authData.user.id || listing.status !== "approved") return json({ error: "Only your approved properties can be boosted" }, 403);
    if (listing.boosted_until && new Date(listing.boosted_until).getTime() > Date.now()) return json({ error: "This post is already boosted" }, 409);
  }

  const planCode = plan === "landlord_premium" ? Deno.env.get("PAYSTACK_LANDLORD_MONTHLY_PLAN_CODE")
    : plan === "tenant_premium" ? Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE")
      : plan === "blue_tick_monthly" ? Deno.env.get("PAYSTACK_BLUE_TICK_MONTHLY_PLAN_CODE") : undefined;
  if ((plan === "landlord_premium" || plan === "tenant_premium" || plan === "blue_tick_monthly") && !planCode) {
    return json({ error: "Monthly Paystack plan is not configured. Ask the RentReady administrator to finish payment setup." }, 503);
  }

  const origin = request.headers.get("origin") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? (origin.startsWith("https://") && (new URL(origin).hostname.endsWith("workers.dev") || new URL(origin).hostname.endsWith("pages.dev")) ? origin : "https://rentready-4g1.pages.dev");
  const reference = `RR-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
  const amount = prices[plan];
  const { error: insertError } = await service.from("subscriptions").insert({
    user_id: authData.user.id,
    plan,
    amount_ngn: amount,
    provider: "paystack",
    provider_reference: reference,
    billing_email: authData.user.email!,
    listing_id: plan === "boost_post" ? body.listing_id! : null,
    status: "pending",
  });
  if (insertError) return json({ error: "Could not start payment. Please try again." }, 500);

  const callbackPath = plan === "blue_tick_monthly" ? "/blue-tick?payment=complete" : plan === "boost_post" ? "/my-listings?payment=complete" : "/dashboard?payment=complete";
  const callback = `${appUrl.replace(/\/$/, "")}${callbackPath}`;
  const paystackBody: Record<string, unknown> = {
    email: authData.user.email,
    amount: amount * 100,
    currency: "NGN",
    reference,
    callback_url: callback,
    metadata: { rentready_user_id: authData.user.id, rentready_plan: plan, rentready_listing_id: body.listing_id ?? null },
  };
  if (planCode) paystackBody.plan = planCode;
  const response = await fetch("https://api.paystack.co/transaction/initialize", {
    method: "POST",
    headers: { Authorization: `Bearer ${paystackSecret}`, "Content-Type": "application/json" },
    body: JSON.stringify(paystackBody),
  });
  const initialized = await response.json().catch(() => null);
  if (!response.ok || !initialized?.status || typeof initialized?.data?.authorization_url !== "string") {
    await service.from("subscriptions").update({ status: "failed" }).eq("provider_reference", reference);
    return json({ error: initialized?.message ?? "Paystack could not initialize payment" }, 502);
  }
  return json({ authorization_url: initialized.data.authorization_url, reference });
});
