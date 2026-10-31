import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, meta } from "@/components/InfoPage";

export const Route = createFileRoute("/terms")({
  head: () => meta("Terms of Service", "The rules for using RentReady as a landlord, agent, buyer or tenant."),
  component: Terms,
});

function Terms() {
  return (
    <InfoPage title="Terms of Service" intro="Last updated: October 2026">
      <h2>Using RentReady</h2>
      <p>RentReady connects people who have property with people looking for it. We are not a party to any rental or sale agreement between users.</p>
      <h2>Listings</h2>
      <ul>
        <li>You may only list properties you own or are authorised to market.</li>
        <li>Prices, descriptions and photos must be accurate. Listings are reviewed before publishing and may be removed.</li>
        <li>Posting is free. Promoted listings are labelled “Sponsored”.</li>
      </ul>
      <h2>Verification</h2>
      <p>Verification badges reflect checks of identity or business registration only. They are not a guarantee of property ownership or legal title. Always inspect properties and confirm documents before paying.</p>
      <h2>Prohibited conduct</h2>
      <p>Fraud, fake listings, harassment, and requests for payment before inspection are not allowed and will lead to account removal.</p>
    </InfoPage>
  );
}
