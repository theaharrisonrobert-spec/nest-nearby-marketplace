import { describe, expect, it } from "vitest";
import { getActiveMobileTab } from "@/lib/mobile-navigation";

describe("mobile navigation active tab", () => {
  it.each([
    ["/", "home"],
    ["/listings", "search"],
    ["/search", "search"],
    ["/messages", "messages"],
    ["/profile", "profile"],
    ["/settings", "settings"],
  ] as const)("highlights %s as %s", (pathname, tab) => {
    expect(getActiveMobileTab(pathname)).toBe(tab);
  });
});
