import { describe, expect, it } from "vitest";
import { getActiveMobileTab } from "@/lib/mobile-navigation";

describe("mobile navigation active tab", () => {
  it.each([
    ["/", "home"],
    ["/listings", "search"],
    ["/search", "search"],
    ["/saved", "saved"],
    ["/messages", "messages"],
    ["/profile", "profile"],
  ] as const)("highlights %s as %s", (pathname, tab) => {
    expect(getActiveMobileTab(pathname)).toBe(tab);
  });

  it.each(["/settings", "/landlords", "/help"]) ("does not highlight non-tab route %s", (pathname) => {
    expect(getActiveMobileTab(pathname)).toBeNull();
  });
});
