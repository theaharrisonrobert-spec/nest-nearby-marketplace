import { createFileRoute, Link } from "@tanstack/react-router";
import { InfoPage, meta } from "@/components/InfoPage";

export const Route = createFileRoute("/contact")({
  head: () => meta("Contact Us", "Get in touch with the RentReady team for help with accounts, listings or verification."),
  component: Contact,
});

function Contact() {
  return (
    <InfoPage title="Contact Us" intro="We're here to help landlords, agents, buyers and tenants.">
      <ul>
        <li>Email: <a href="mailto:support@rentready.ng" className="text-primary">support@rentready.ng</a></li>
        <li>Hours: Monday – Friday, 9am – 5pm (WAT)</li>
      </ul>
      <p>To report a suspicious property, use the “Report this listing” button on the listing itself so our team can see exactly which one you mean. Common questions are answered in the <Link to="/help" className="text-primary">Help Centre</Link>.</p>
    </InfoPage>
  );
}
