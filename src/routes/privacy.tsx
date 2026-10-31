import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, meta } from "@/components/InfoPage";

export const Route = createFileRoute("/privacy")({
  head: () => meta("Privacy Policy", "How RentReady collects, uses, stores and protects your personal data and identity documents."),
  component: Privacy,
});

function Privacy() {
  return (
    <InfoPage title="Privacy Policy" intro="Last updated: October 2026">
      <h2>What we collect</h2>
      <ul>
        <li>Account details: name, email, phone number and account type.</li>
        <li>Identity documents you submit for verification (passport, NIN or driver's licence).</li>
        <li>Listings, messages, viewing requests and reports you create.</li>
      </ul>
      <h2>How we use it</h2>
      <p>To run your account, verify identities, review listings, deliver messages, prevent fraud, and contact you about your account.</p>
      <h2>Identity documents</h2>
      <p>ID documents are stored in private, encrypted storage. Only you and authorised RentReady reviewers can access them, and only for verification. They are never shown on listings or shared with other users.</p>
      <h2>What others can see</h2>
      <p>Other users see your listings, your display name and your verification badges. Your phone number and email are not shown publicly. Exact addresses are hidden unless you choose to show them.</p>
      <h2>Your rights</h2>
      <p>You can ask to access, correct or delete your data by contacting us. We handle personal data in line with the Nigeria Data Protection Act 2023.</p>
    </InfoPage>
  );
}
