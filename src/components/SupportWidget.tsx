import { useState } from "react";
import { Bot, LifeBuoy, Send, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSession } from "@/hooks/use-session";

const categories = ["Report listing", "Report scam", "Payment", "Login", "Landlord not responding", "Other"] as const;
type Category = typeof categories[number];
const answers: Record<Category, string> = {
  "Report listing": "Thanks for reporting. Please send the link to the listing + what's wrong with it. Our team will review it within 24 hours and remove it if it breaks our rules.",
  "Report scam": "I'm sorry about this. Please don't send any more money. Send us the agent's name/number + screenshots + the listing link. We will block the account and help you report it.",
  Payment: "For payment: You pay only through RentReady after your inspection is confirmed. We accept bank transfer / card. Never pay an agent directly before inspection. Need help with a specific payment? Send your reference.",
  Login: "Can't log in? Tap Forgot Password on the login page to reset it. If you didn't get the SMS code, wait 2 mins and tap Resend. Still stuck? Tell us your phone number here.",
  "Landlord not responding": "Sorry about that. Tell us the property name + landlord's name. We will contact them today and if they don't respond in 24 hours, we will suggest similar properties for you.",
  Other: "No problem, connecting you to our team now. Please tell us what you need help with.",
};

export function SupportWidget() {
  const { user } = useSession();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<Category | "">("");
  const [details, setDetails] = useState("");
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const { data: profile } = useQuery({
    queryKey: ["support-profile", user?.id], enabled: !!user,
    queryFn: async () => user ? (await supabase.from("profiles").select("approval_status, is_blocked").eq("id", user.id).maybeSingle()).data : null,
  });
  const canIdentifyAsApproved = !!profile && profile.approval_status === "approved" && !profile.is_blocked;
  const message = encodeURIComponent(`RentReady support request${category ? ` — ${category}` : ""}: ${details.trim()}`);

  function reset() {
    setCategory(""); setDetails(""); setSubmitted(false); setError("");
  }
  async function createTicket() {
    if (!category || details.trim().length < 3) { setError("Choose a category and enter at least 3 characters of detail."); return; }
    setSaving(true); setError("");
    const { error: insertError } = await supabase.from("support_tickets").insert({
      user_id: canIdentifyAsApproved && user ? user.id : null,
      contact_email: user?.email ?? null,
      category,
      details: details.trim().slice(0, 2000),
      page_url: window.location.href.slice(0, 1000),
      status: "open",
    });
    setSaving(false);
    if (insertError) { setError("We could not save your ticket. Please try again or email rentreadyng@gmail.com."); return; }
    setSubmitted(true);
  }

  return <>
    <button type="button" onClick={() => setOpen(true)} className="fixed bottom-40 right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-primary px-5 py-3 font-semibold text-white shadow-xl hover:bg-primary/90 lg:bottom-6 lg:right-6" aria-label="Open RentReady support bot">
      <LifeBuoy className="h-5 w-5" /> Support
    </button>
    {open && <div className="fixed inset-0 z-[70] flex items-end justify-end bg-black/25 p-0 sm:items-end sm:p-5" onClick={() => setOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label="RentReady support" onClick={(event) => event.stopPropagation()} className="flex max-h-[85vh] w-full flex-col overflow-hidden rounded-t-2xl bg-white text-foreground shadow-2xl sm:max-w-md sm:rounded-2xl">
        <header className="flex items-center justify-between bg-primary px-5 py-4 text-white">
          <div className="flex items-center gap-2"><Bot className="h-5 w-5" /><div><p className="font-semibold">RentReady Support</p><p className="text-xs text-white/75">Tell us how we can help</p></div></div>
          <button type="button" onClick={() => setOpen(false)} aria-label="Close support" className="rounded p-1 hover:bg-white/10"><X className="h-5 w-5" /></button>
        </header>
        <div className="space-y-4 overflow-y-auto p-5 text-sm">
          {!category && !submitted && <>
            <p className="rounded-xl bg-muted/70 p-3">Hi! What do you need help with?</p>
            <div className="grid grid-cols-2 gap-2">{categories.map((item) => <button key={item} type="button" onClick={() => setCategory(item)} className="rounded-lg border border-border px-3 py-2 text-left hover:border-primary hover:text-primary">{item}</button>)}</div>
          </>}
          {category && !submitted && <>
            <p className="ml-auto w-fit rounded-xl bg-primary/10 px-3 py-2 font-medium">{category}</p>
            <p className="rounded-xl bg-muted/70 p-3">{answers[category]}</p>
            <label className="block text-xs font-semibold text-muted-foreground">Add details<textarea value={details} onChange={(event) => setDetails(event.target.value)} maxLength={2000} rows={4} placeholder="Tell us what happened. Add a property link if relevant." className="mt-1.5 w-full rounded-lg border border-border p-3 text-sm outline-none focus:border-primary" /></label>
            {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            {!canIdentifyAsApproved && user && <p className="text-xs text-muted-foreground">Your request will be sent as an unverified support ticket while your profile is under review.</p>}
            <button type="button" disabled={saving} onClick={() => void createTicket()} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary py-3 font-semibold text-white disabled:opacity-60"><Send className="h-4 w-4" />{saving ? "Creating ticket…" : "Talk to Human Support"}</button>
          </>}
          {submitted && <div className="space-y-3"><p role="status" className="rounded-xl bg-brand-soft p-4 font-medium text-foreground">Your support ticket is open. The RentReady team can review the details you sent.</p><a href={`https://wa.me/?text=${message}`} target="_blank" rel="noreferrer" className="block rounded-lg border border-primary px-4 py-3 text-center font-semibold text-primary">Continue in WhatsApp</a><a href="mailto:rentreadyng@gmail.com" className="block text-center text-xs text-muted-foreground underline">Email rentreadyng@gmail.com</a><button type="button" onClick={reset} className="w-full text-sm text-muted-foreground underline">Start another request</button></div>}
        </div>
      </section>
    </div>}
  </>;
}
