export type WelcomeEmailEvent = "welcome_landlord" | "welcome_tenant";

export type WelcomeEmail = {
  subject: string;
  text: string;
};

export function createWelcomeEmail(event: WelcomeEmailEvent, firstName: string): WelcomeEmail {
  if (event === "welcome_landlord") {
    return {
      subject: "Welcome to RentReady, Landlord — Let's Get Your Property Rented 🏠",
      text: [
        `Hi ${firstName},`,
        "Welcome to RentReady!",
        "Thank you for joining as a Landlord. You made the right choice.",
        "RentReady was built to help real landlords like you find serious, verified tenants — without agents, without wahala.",
        "Here's what to do next:",
        "Verify Your Identity — Upload your ID + a selfie holding your ID. Your name must match the name you signed up with. This keeps RentReady safe for everyone.",
        "List Your Property — Once verified, you can post your house, flat, self-contain, or shop.",
        "Chat Directly — Tenants will message you directly. No middleman.",
        "Your account is ready. Your journey to finding a good tenant starts now.",
        "Welcome aboard,",
        "The RentReady Team",
        "rentreadyng@gmail.com",
      ].join("\n\n"),
    };
  }

  return {
    subject: "Welcome to RentReady — Your New Home Is Waiting For You 🔑",
    text: [
      `Hi ${firstName},`,
      "Welcome to RentReady!",
      "Thank you for joining as a Tenant. We're happy to have you.",
      "No more fake listings. No more agent wahala. No more paying to see a house that doesn't exist.",
      "On RentReady, you can:",
      "Browse Real Houses — Search by area, price, and property type.",
      "Chat Directly With Landlords — Ask questions and book a viewing yourself.",
      "Save Your Favourites — Keep the houses you love in one place.",
      "Start searching now and find a place you will truly love to call home.",
      "Welcome home,",
      "The RentReady Team",
      "rentreadyng@gmail.com",
    ].join("\n\n"),
  };
}

export function welcomeEmailHtml(text: string): string {
  const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]!);

  return text.split("\n\n").map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
}
