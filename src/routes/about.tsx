import { createFileRoute } from "@tanstack/react-router";
import { InfoPage, meta } from "@/components/InfoPage";

export const Route = createFileRoute("/about")({
  head: () => meta("About RentReady", "Learn about RentReady, a place to find and share property listings across Nigeria."),
  component: About,
});

function About() {
  return (
    <InfoPage title="About RentReady" intro="Your space. Your choice. Your next move.">
      <p>RentReady helps people discover homes, shops, offices, land, and other spaces across Nigeria. Browse listings, contact property owners, and arrange viewings directly.</p>
      <p>We review listings before they go live and provide tools for reporting suspicious or outdated information. Identity badges describe account checks and do not replace your own property and ownership checks.</p>
    </InfoPage>
  );
}
