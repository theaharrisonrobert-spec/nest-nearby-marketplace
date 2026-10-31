import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage, meta } from "@/components/InfoPage";

export const Route = createFileRoute("/help")({
  head: () => meta("Help Centre & FAQs", "Answers about accounts, verification, posting, messaging, viewings and safety on RentReady."),
  component: Help,
});

const FAQS = [
  ["Is it free to post a property?", "Yes. Landlords and agents post for free. Later you'll be able to pay to promote a listing; promoted listings are always labelled “Sponsored”."],
  ["Why must I verify my identity before posting?", "To reduce fraud, landlords and agents submit a government ID (international passport, NIN or driver's licence). Our team reviews it before you can publish."],
  ["Does a “Verified identity” badge mean the property is legally verified?", "No. It only means we checked the person's ID. “Verified agency” means we checked a business registration, and “Details reviewed” means our team looked over the listing. Always confirm title documents yourself before paying."],
  ["Why can't I see the owner's phone number?", "To protect everyone's privacy, contact happens through private messages. Either side can choose to share a number in a message."],
  ["How do viewings work?", "Pick a date and time on the listing. The owner can accept, decline or suggest another time — you'll see updates in your dashboard."],
  ["Why isn't my new listing showing?", "Every listing is reviewed before going live. You can see its status in your dashboard."],
  ["What are “Sample listings”?", "They show how RentReady listings look. They are not real properties and cannot be rented or bought."],
  ["How do I report a suspicious listing?", "Open the listing and tap “Report this listing”. You can report fraud, wrong prices, duplicates, or properties no longer available."],
  ["I forgot my password.", "Use “Forgot password?” on the sign-in page to reset it."],
];

function Help() {
  return (
    <InfoPage title="Help Centre" intro="Find quick answers below, or contact us if you need more help.">
      <h2>Frequently asked questions</h2>
      <div className="space-y-3">
        {FAQS.map(([q, a]) => (
          <details key={q} className="rounded-xl border border-border bg-card p-4">
            <summary className="cursor-pointer font-semibold text-foreground">{q}</summary>
            <p className="mt-2 text-sm">{a}</p>
          </details>
        ))}
      </div>
      <p>Still need help? <Link to="/contact" className="font-medium text-primary">Contact us</Link>.</p>
    </InfoPage>
  );
}
