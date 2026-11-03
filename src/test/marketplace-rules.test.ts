import { describe, expect, it } from "vitest";
import { accountType, canPublish, canRequestPromotion, categoryMatches, REGISTRATION_TYPES } from "@/lib/marketplace-rules";

describe("Marketplace rules", () => {
  it("offers only landlord and buyer/tenant registration", () => {
    expect(REGISTRATION_TYPES).toEqual(["landlord", "tenant"]);
    expect(accountType("agent")).toBe("tenant");
  });
  it("requires an approved landlord to post", () => {
    expect(canPublish("landlord", "approved")).toBe(true);
    expect(canPublish("landlord", "pending")).toBe(false);
    expect(canPublish("tenant", "approved")).toBe(false);
    expect(canPublish("agent", "approved")).toBe(false);
  });
  it("returns only shops when shops are selected", () => {
    expect(["Shops", "Malls", "Apartments", "Land"].filter(c => categoryMatches(c, "Shops"))).toEqual(["Shops"]);
  });
  it.each(["Malls", "Office Spaces", "Event Halls", "Land", "Other Spaces"])("keeps %s separate", category => {
    expect(categoryMatches(category, category)).toBe(true);
    expect(categoryMatches("Shops", category)).toBe(false);
  });
  it("allows promotion requests only for live, unpromoted listings", () => {
    expect(canRequestPromotion({ status: "approved", sponsored: false, promotion_requested: false })).toBe(true);
    expect(canRequestPromotion({ status: "pending", sponsored: false, promotion_requested: false })).toBe(false);
    expect(canRequestPromotion({ status: "approved", sponsored: true, promotion_requested: false })).toBe(false);
    expect(canRequestPromotion({ status: "approved", sponsored: false, promotion_requested: true })).toBe(false);
  });
});