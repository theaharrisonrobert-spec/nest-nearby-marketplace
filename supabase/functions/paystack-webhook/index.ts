import { createClient } from "npm:@supabase/supabase-js@2";

async function signatureMatches(rawBody: string, secret: string, signature: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody)));
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  if (expected.length !== signature.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
  return diff === 0;
}

async function timestampedSignatureMatches(rawBody: string, secret: string, header: string) {
  const fields = header.split(",").map((part) => part.trim());
  const timestamp = fields.find((part) => part.startsWith("t="))?.slice(2);
  if (!timestamp || !/^\d+$/.test(timestamp) || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300) return false;
  const signatures = fields.filter((part) => part.startsWith("v1=")).map((part) => part.slice(3).split(":").at(-1) ?? "");
  if (!signatures.length) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const digest = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${timestamp}.${rawBody}`)));
  const expected = [...digest].map((byte) => byte.toString(16).padStart(2, "0")).join("");
  return signatures.some((signature) => {
    if (signature.length !== expected.length) return false;
    let diff = 0;
    for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ signature.charCodeAt(i);
    return diff === 0;
  });
}

const webhookCors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type, x-paystack-signature, paystack-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function withCors(response: Response) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(webhookCors)) headers.set(key, value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

Deno.serve(async (request) => {
  try {
    return withCors(await handleWebhook(request));
  } catch (error) {
    console.error("Paystack webhook processing error", error);
    return withCors(new Response("Internal server error", { status: 500 }));
  }
});

async function handleWebhook(request: Request) {
  if (request.method === "OPTIONS") return new Response("ok", { status: 200 });
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const secret = Deno.env.get("PAYSTACK_SECRET_KEY");
  const url = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const legacySignature = request.headers.get("x-paystack-signature") ?? "";
  const modernSignature = request.headers.get("paystack-signature");
  const webhookSecret = Deno.env.get("PAYSTACK_WEBHOOK_SECRET");
  if (!secret || !url || !serviceKey) return new Response("Not configured", { status: 503 });
  const raw = await request.text();
  const validSignature = modernSignature
    ? !!webhookSecret && await timestampedSignatureMatches(raw, webhookSecret, modernSignature)
    : !!legacySignature && await signatureMatches(raw, secret, legacySignature);
  if (!validSignature) return new Response("Invalid signature", { status: 401 });
  let event: { event?: string; data?: { reference?: string; status?: string; amount?: number; email?: string; customer?: { email?: string }; plan?: { plan_code?: string }; subscription?: { subscription_code?: string }; subscription_code?: string; email_token?: string } };
  try { event = JSON.parse(raw); } catch { return new Response("Invalid JSON", { status: 400 }); }

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const customerEmail = event.data?.customer?.email ?? event.data?.email;
  const tenantPlanCode = Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE");
  const tenantSubscriptionCode = event.data?.subscription_code ?? event.data?.subscription?.subscription_code;

  if (event.event === "subscription.create" && tenantPlanCode && event.data?.plan?.plan_code === tenantPlanCode
    && customerEmail && tenantSubscriptionCode && event.data.email_token) {
    const { data: tenantSubscription, error } = await admin.from("tenant_subscriptions").select("id")
      .eq("email", customerEmail).in("status", ["pending", "active"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (error) return new Response("Could not find Tenant Premium checkout", { status: 500 });
    if (tenantSubscription) {
      const { error: updateError } = await admin.from("tenant_subscriptions").update({
        paystack_subscription_code: tenantSubscriptionCode,
        paystack_subscription_token: event.data.email_token,
        updated_at: new Date().toISOString(),
      }).eq("id", tenantSubscription.id);
      if (updateError) return new Response("Could not save Tenant Premium renewal details", { status: 500 });
    }
    return new Response("Tenant subscription recorded", { status: 200 });
  }

  if ((event.event === "subscription.not_renew" || event.event === "subscription.disable") && tenantSubscriptionCode) {
    const { data: row } = await admin.from("tenant_subscriptions").select("id, current_period_end")
      .eq("paystack_subscription_code", tenantSubscriptionCode).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
    if (row) {
      const stillPaid = !!row.current_period_end && new Date(row.current_period_end).getTime() > Date.now();
      const { error } = await admin.from("tenant_subscriptions").update({
        status: stillPaid ? "active" : "cancelled",
        cancel_at_period_end: true,
        updated_at: new Date().toISOString(),
      }).eq("id", row.id);
      if (error) return new Response("Could not update Tenant Premium cancellation", { status: 500 });
    }
    return new Response("Tenant cancellation recorded", { status: 200 });
  }

  if (event.event === "invoice.payment_failed" && tenantSubscriptionCode) {
    const { error } = await admin.from("tenant_subscriptions").update({ status: "failed", updated_at: new Date().toISOString() })
      .eq("paystack_subscription_code", tenantSubscriptionCode).eq("status", "active");
    if (error) return new Response("Could not update failed Tenant Premium payment", { status: 500 });
    return new Response("Tenant payment failure recorded", { status: 200 });
  }

  if (event.event === "charge.success" && tenantPlanCode && event.data?.plan?.plan_code === tenantPlanCode && event.data.reference) {
    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(event.data.reference)}`, {
      headers: { Authorization: `Bearer ${secret}` },
    });
    const verified = await verifyResponse.json().catch(() => null);
    const payment = verified?.data;
    if (!verifyResponse.ok || verified?.status !== true || payment?.status !== "success"
      || payment?.amount !== 200000 || payment?.currency !== "NGN") return new Response("Tenant payment could not be verified", { status: 400 });
    const metadata = payment.metadata ?? {};
    let tenantRow = (await admin.from("tenant_subscriptions").select("id, current_period_end, email, status, paystack_reference")
      .eq("paystack_reference", event.data.reference).maybeSingle()).data;
    const alreadyActivatedReference = tenantRow?.status === "active" && tenantRow.paystack_reference === event.data.reference;
    if (!tenantRow && tenantSubscriptionCode) {
      tenantRow = (await admin.from("tenant_subscriptions").select("id, current_period_end, email, status, paystack_reference")
        .eq("paystack_subscription_code", tenantSubscriptionCode).eq("status", "active")
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    }
    if (!tenantRow && customerEmail) {
      tenantRow = (await admin.from("tenant_subscriptions").select("id, current_period_end, email, status, paystack_reference")
        .eq("email", customerEmail).in("status", ["pending", "active"])
        .order("created_at", { ascending: false }).limit(1).maybeSingle()).data;
    }
    if (!tenantRow || tenantRow.email.toLowerCase() !== payment.customer?.email?.toLowerCase()) return new Response("Tenant checkout not found", { status: 404 });
    if (alreadyActivatedReference) return new Response("Tenant payment already processed", { status: 200 });
    const periodBase = tenantRow.current_period_end && new Date(tenantRow.current_period_end).getTime() > Date.now()
      ? new Date(tenantRow.current_period_end).getTime() : Date.now();
    const nextPaymentDate = payment.subscription?.next_payment_date;
    const parsedNextPaymentDate = typeof nextPaymentDate === "string" ? new Date(nextPaymentDate) : null;
    const { error } = await admin.from("tenant_subscriptions").update({
      paystack_reference: event.data.reference,
      paystack_authorization_code: payment.authorization?.authorization_code ?? null,
      paystack_subscription_code: tenantSubscriptionCode ?? null,
      status: "active",
      amount: 200000,
      current_period_end: parsedNextPaymentDate && Number.isFinite(parsedNextPaymentDate.getTime()) && parsedNextPaymentDate.getTime() > Date.now()
        ? parsedNextPaymentDate.toISOString()
        : new Date(periodBase + 30 * 24 * 60 * 60 * 1000).toISOString(),
      updated_at: new Date().toISOString(),
    }).eq("id", tenantRow.id);
    if (error) return new Response("Could not activate Tenant Premium", { status: 500 });
    return new Response("Tenant Premium activated", { status: 200 });
  }

  if (event.event === "subscription.create" && customerEmail && event.data?.subscription_code && event.data.email_token && event.data.plan?.plan_code) {
    const landlordCode = Deno.env.get("PAYSTACK_LANDLORD_MONTHLY_PLAN_CODE");
    const tenantCode = Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE");
    const blueTickCode = Deno.env.get("PAYSTACK_BLUE_TICK_MONTHLY_PLAN_CODE");
    const plan = event.data.plan.plan_code === landlordCode ? "landlord_premium"
      : event.data.plan.plan_code === tenantCode ? "tenant_premium"
        : event.data.plan.plan_code === blueTickCode ? "blue_tick_monthly" : null;
    if (plan) {
      const { data: subscription } = await admin.from("subscriptions").select("id").eq("billing_email", customerEmail)
        .eq("plan", plan).in("status", ["pending", "active"]).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (subscription) await admin.from("subscriptions").update({ provider_subscription_code: event.data.subscription_code, provider_subscription_token: event.data.email_token }).eq("id", subscription.id);
    }
    return new Response("Subscription recorded", { status: 200 });
  }
  if (event.event !== "charge.success" || !event.data?.reference || event.data.status !== "success") return new Response("Ignored", { status: 200 });
  let { data: payment } = await admin.from("subscriptions").select("*").eq("provider_reference", event.data.reference).maybeSingle();
  let recurring = false;
  if (!payment && customerEmail && event.data.plan?.plan_code) {
    const landlordPlanCode = Deno.env.get("PAYSTACK_LANDLORD_MONTHLY_PLAN_CODE");
    const tenantPlanCode = Deno.env.get("PAYSTACK_TENANT_MONTHLY_PLAN_CODE");
    const blueTickPlanCode = Deno.env.get("PAYSTACK_BLUE_TICK_MONTHLY_PLAN_CODE");
    const recurringPlan = event.data.plan.plan_code === landlordPlanCode ? "landlord_premium"
      : event.data.plan.plan_code === tenantPlanCode ? "tenant_premium"
        : event.data.plan.plan_code === blueTickPlanCode ? "blue_tick_monthly" : null;
    if (recurringPlan) {
      const result = await admin.from("subscriptions").select("*").eq("billing_email", customerEmail)
        .eq("plan", recurringPlan).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
      payment = result.data;
      recurring = !!payment;
    }
  }
  if (!payment) return new Response("Unknown reference", { status: 404 });
  const { data: applied, error } = await admin.rpc("apply_paystack_payment", {
    _subscription_id: payment.id,
    _charge_reference: event.data.reference,
    _amount_kobo: event.data.amount ?? 0,
    _recurring: recurring,
  });
  if (error) return new Response("Could not activate payment", { status: 500 });
  return new Response(applied ? "ok" : "Already processed", { status: 200 });
}
