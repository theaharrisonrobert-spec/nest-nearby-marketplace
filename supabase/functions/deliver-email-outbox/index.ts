import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";
import { createWelcomeEmail, welcomeEmailHtml, type WelcomeEmailEvent } from "../_shared/welcome-email.ts";

const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
const sender = "rentreadyng@gmail.com";
const labels: Record<string, string> = {
  signup: "New RentReady signup",
  listing: "New property listed",
  viewing_request: "New viewing request",
  viewing_completed: "Viewing completed and rated",
  premium_payment: "New RentReady premium payment",
  admin_notification: "New RentReady admin notification", 
};
Deno.serve(async (request) => {
  if (request.method !== "POST") return new Response("Method not allowed", { status: 405 });
  const hookSecret = Deno.env.get("DELIVERY_WEBHOOK_SECRET");
  if (!hookSecret || request.headers.get("x-rentready-secret") !== hookSecret) return new Response("Unauthorized", { status: 401 });
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const mailUser = Deno.env.get("GMAIL_SMTP_USER");
  const mailPassword = Deno.env.get("GMAIL_APP_PASSWORD");
  if (!supabaseUrl || !serviceKey || !mailUser || !mailPassword || mailUser.toLowerCase() !== sender) return new Response("Email service is not configured for rentreadyng@gmail.com", { status: 503 });

  let webhook: { record?: { id?: number }; id?: number };
  try { webhook = await request.json(); } catch { return new Response("Invalid webhook payload", { status: 400 }); }
  const outboxId = Number(webhook.record?.id ?? webhook.id);
  if (!Number.isSafeInteger(outboxId) || outboxId < 1) return new Response("Missing email queue id", { status: 400 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: claimed, error: claimError } = await admin.rpc("claim_email_outbox", { _id: outboxId });
  const message = claimed?.[0];
  if (claimError) return new Response("Could not claim email", { status: 500 });
  if (!message) return new Response("Already sent or being delivered", { status: 200 });
  const isWelcome = message.event === "welcome_landlord" || message.event === "welcome_tenant";
  const recipient = String(message.recipient ?? "");
  if (!labels[message.event] && !isWelcome) return new Response("Invalid email event", { status: 400 });
  if (isWelcome ? !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient) : recipient !== sender) {
    return new Response("Invalid email recipient", { status: 400 });
  }

  let subject = labels[message.event];
  let text: string;
  let html: string;
  if (isWelcome) {
    const welcome = createWelcomeEmail(message.event as WelcomeEmailEvent, String(message.payload?.first_name ?? "there"));
    subject = welcome.subject;
    text = welcome.text;
    html = welcomeEmailHtml(welcome.text);
  } else {
    const payload = message.payload as Record<string, unknown>;
    text = Object.entries(payload).filter(([key]) => key !== "viewing_id").map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value ?? "—")}`).join("\n");
    const body = Object.entries(payload)
      .filter(([key]) => key !== "viewing_id")
      .map(([key, value]) => `<p><strong>${escapeHtml(key.replaceAll("_", " "))}:</strong> ${escapeHtml(value)}</p>`).join("");
    html = `<h2>${escapeHtml(subject!)}</h2>${body}`;
  }

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("GMAIL_SMTP_HOST") ?? "smtp.gmail.com",
    port: Number(Deno.env.get("GMAIL_SMTP_PORT") ?? "465"),
    secure: true,
    auth: { user: mailUser, pass: mailPassword },
  });
  try {
    await transporter.sendMail({
      from: `RentReady <${sender}>`,
      to: recipient,
      subject,
      text,
      html,
    });
    const { error } = await admin.from("email_outbox").update({ sent_at: new Date().toISOString(), claimed_at: null }).eq("id", outboxId);
    if (error) return new Response("Email sent but queue update failed", { status: 500 });
    return new Response("sent", { status: 200 });
  } catch (error) {
    await admin.from("email_outbox").update({ claimed_at: null }).eq("id", outboxId);
    return new Response(error instanceof Error ? error.message : "SMTP delivery failed", { status: 502 });
  }
});
