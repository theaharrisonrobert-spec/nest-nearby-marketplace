export const REGISTRATION_TYPES = ["landlord", "tenant"] as const;
export type RegistrationType = typeof REGISTRATION_TYPES[number];

export function accountType(value: unknown): RegistrationType {
  return value === "landlord" ? "landlord" : "tenant";
}

export function canPublish(type: string | null | undefined, verification: string | null | undefined) {
  return type === "landlord" && verification === "approved";
}

export function categoryMatches(actual: string, selected?: string) {
  return !selected || actual === selected;
}

export function canRequestPromotion(listing: { status: string; sponsored: boolean; promotion_requested: boolean }) {
  return listing.status === "approved" && !listing.sponsored && !listing.promotion_requested;
}