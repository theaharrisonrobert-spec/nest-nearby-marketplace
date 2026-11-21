import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const prices = {
  landlord_premium: 5000,
  tenant_premium: 2000,
  featured_listing: 2000,
  nin_verification: 1500,
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
  const { data: profile, error: profileError } = await service.from("profiles").select("account_type, verification_fee_paid, approval_status, is_blocked").eq("id", authData.user.id).maybeSingle();
  if (profileError || !profile) return json({ error: "Could not load your RentReady profile" }, 400);
  if (profile.approval_status !== "approved" || profile.is_blocked) return json({ error: "Your account must be approved before making a payment" }, 403);
  if (plan === "landlord_premium" && profile.account_type !== "landlord") return json({ error: "Landlord Premium is for landlord accounts" }, 403);
  if (plan === "tenant_premium" && profile.account_type !== "tenant") return json({ error: "Tenant Premium is for tenant accounts" }, 403);
  if (plan === "nin_verification" && (profile.account_type !== "landlord" || profile.verification_fee_paid)) return json({ error: "This verification fee is for landlords and can only be paid once" }, 400);

  if (plan === "featured_listing") {
    if (!body.listing_id) return json({ error: "Choose the property to feature" }, 400);
    const { data: listing } = await service.from("listings").select("id, status, owner_id").eq("id", body.listing_id).maybeSingle();
    if (!listing || listing.owner_id !== authData.user.id || listing.status !== "approved") return json({ error: "Only your approved properties can be featured" }, 403);
  }

  const planCode = plan === "landlord_premium" ? Deno.env.get("PAYSTACK_LANDLORD_MONTHLY_PLAN_CODE")
    : plan === "tenant_premium" ? Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE") : undefined;
  if ((plan === "landlord_premium" || plan === "tenant_premium") && !planCode) {
    return json({ error: "Monthly Paystack plan is not configured. Ask the RentReady administrator to finish payment setup." }, 503);
  }

  const origin = request.headers.get("origin") ?? "";
  const appUrl = Deno.env.get("APP_URL") ?? (origin.startsWith("https://") && new URL(origin).hostname.endsWith("workers.dev") ? origin : "http://localhost:5173");
  const reference = `RR-${crypto.randomUUID().replaceAll("-", "").toUpperCase()}`;
  const amount = prices[plan];
  const { error: insertError } = await service.from("subscriptions").insert({
    user_id: authData.user.id,
    plan,
    amount_ngn: amount,
    provider: "paystack",
    provider_reference: reference,
    billing_email: authData.user.email!,
    listing_id: plan === "featured_listing" ? body.listing_id! : null,
    status: "pending",
  });
  if (insertError) return json({ error: "Could not start payment. Please try again." }, 500);

  const callback = `${appUrl.replace(/\/$/, "")}${plan === "nin_verification" ? "/verify?payment=complete" : "/dashboard?payment=complete"}`;
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
