import { createClient } from "npm:@supabase/supabase-js@2";
import nodemailer from "npm:nodemailer@6.10.1";

const escapeHtml = (value: unknown) => String(value ?? "—").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!);
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
  if (!supabaseUrl || !serviceKey || !mailUser || !mailPassword) return new Response("Email service is not configured", { status: 503 });

  let webhook: { record?: { id?: number }; id?: number };
  try { webhook = await request.json(); } catch { return new Response("Invalid webhook payload", { status: 400 }); }
  const outboxId = Number(webhook.record?.id ?? webhook.id);
  if (!Number.isSafeInteger(outboxId) || outboxId < 1) return new Response("Missing email queue id", { status: 400 });

  const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });
  const { data: claimed, error: claimError } = await admin.rpc("claim_email_outbox", { _id: outboxId });
  const message = claimed?.[0];
  if (claimError) return new Response("Could not claim email", { status: 500 });
  if (!message) return new Response("Already sent or being delivered", { status: 200 });
  const subject = labels[message.event];
  if (!subject || message.recipient !== "rentreadyng@gmail.com") return new Response("Invalid email event", { status: 400 });
  const body = Object.entries(message.payload as Record<string, unknown>)
    .filter(([key]) => key !== "viewing_id")
    .map(([key, value]) => `<p><strong>${escapeHtml(key.replaceAll("_", " "))}:</strong> ${escapeHtml(value)}</p>`).join("");

  const transporter = nodemailer.createTransport({
    host: Deno.env.get("GMAIL_SMTP_HOST") ?? "smtp.gmail.com",
    port: Number(Deno.env.get("GMAIL_SMTP_PORT") ?? "465"),
    secure: true,
    auth: { user: mailUser, pass: mailPassword },
  });
  try {
    await transporter.sendMail({
      from: `RentReady <${mailUser}>`,
      to: "rentreadyng@gmail.com",
      subject,
      text: Object.entries(message.payload as Record<string, unknown>).filter(([key]) => key !== "viewing_id").map(([key, value]) => `${key.replaceAll("_", " ")}: ${String(value ?? "—")}`).join("\n"),
      html: `<h2>${escapeHtml(subject)}</h2>${body}`,
    });
    const { error } = await admin.from("email_outbox").update({ sent_at: new Date().toISOString(), claimed_at: null }).eq("id", outboxId);
    if (error) return new Response("Email sent but queue update failed", { status: 500 });
    return new Response("sent", { status: 200 });
  } catch (error) {
    await admin.from("email_outbox").update({ claimed_at: null }).eq("id", outboxId);
    return new Response(error instanceof Error ? error.message : "SMTP delivery failed", { status: 502 });
  }
});
