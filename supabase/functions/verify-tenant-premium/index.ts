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
  if (!url || !anonKey || !serviceKey || !paystackKey) return json({ error: "Payment verification is not configured" }, 503);
  if (!authorization) return json({ error: "Sign in to verify this payment" }, 401);

  try {
    const userClient = createClient(url, anonKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false } });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Your session expired. Sign in and check your dashboard." }, 401);
    let body: { reference?: unknown };
    try { body = await request.json(); } catch { return json({ error: "Invalid request" }, 400); }
    if (typeof body.reference !== "string" || !/^RRTP-[A-Z0-9]{32}$/.test(body.reference)) return json({ error: "Invalid payment reference" }, 400);

    const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
    const { data: row, error: rowError } = await admin.from("tenant_subscriptions").select("id, email, status, current_period_end, paystack_subscription_code, paystack_subscription_token")
      .eq("paystack_reference", body.reference).eq("user_id", user.id).maybeSingle();
    if (rowError || !row) return json({ error: "This payment does not belong to your account" }, 404);
    if (row.status === "active" && row.current_period_end && new Date(row.current_period_end).getTime() > Date.now()) {
      return json({ success: true, current_period_end: row.current_period_end });
    }

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(body.reference)}`, {
      headers: { Authorization: `Bearer ${paystackKey}` },
    });
    const result = await response.json().catch(() => null);
    const payment = result?.data;
    if (!response.ok || result?.status !== true || payment?.status !== "success") {
      await admin.from("tenant_subscriptions").update({ status: "failed" }).eq("id", row.id).eq("status", "pending");
      return json({ success: false, error: result?.message ?? "Paystack could not confirm this payment" }, 402);
    }
    const metadata = payment.metadata ?? {};
    if (payment.amount !== 200000 || payment.currency !== "NGN" || payment.customer?.email?.toLowerCase() !== row.email.toLowerCase()
      || metadata.user_id !== user.id || metadata.plan !== "tenant_premium" || typeof payment.authorization?.authorization_code !== "string") {
      return json({ success: false, error: "Payment details did not match your RentReady account" }, 400);
    }

    const nextPaymentDate = payment.subscription?.next_payment_date;
    const parsedNextPaymentDate = typeof nextPaymentDate === "string" ? new Date(nextPaymentDate) : null;
    const currentPeriodEnd = parsedNextPaymentDate && Number.isFinite(parsedNextPaymentDate.getTime()) && parsedNextPaymentDate.getTime() > Date.now()
      ? parsedNextPaymentDate.toISOString()
      : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const { error: updateError } = await admin.from("tenant_subscriptions").update({
      status: "active",
      current_period_end: currentPeriodEnd,
      paystack_authorization_code: payment.authorization.authorization_code,
      paystack_subscription_code: payment.subscription?.subscription_code ?? row.paystack_subscription_code,
      paystack_subscription_token: row.paystack_subscription_token,
      updated_at: new Date().toISOString(),
    }).eq("id", row.id);
    if (updateError) return json({ error: "Payment succeeded, but RentReady could not update your subscription" }, 500);
    return json({ success: true, current_period_end: currentPeriodEnd });
  } catch (error) {
    console.error("Tenant Premium verification error", error);
    return json({ error: "Could not verify the payment right now" }, 500);
  }
});
