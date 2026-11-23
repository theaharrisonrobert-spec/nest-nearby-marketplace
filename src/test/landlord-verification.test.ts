import { describe, expect, it } from "vitest";
import { MAX_VERIFICATION_FILE_SIZE, validateLandlordVerification, type LandlordVerificationInput } from "@/lib/landlord-verification";

const validInput: LandlordVerificationInput = {
  accountType: "landlord",
  verificationFeePaid: true,
  phoneVerified: true,
  registeredName: "Alex Sample",
  nameMatchConfirmed: true,
  idFile: { type: "image/png", size: 1024 },
  selfieFile: { type: "image/jpeg", size: 2048 },
};

describe("landlord ID and selfie verification", () => {
  it("accepts landlord submissions with required checks and both files", () => {
    expect(validateLandlordVerification(validInput)).toBeNull();
  });

  it("rejects non-landlord accounts", () => {
    expect(validateLandlordVerification({ ...validInput, accountType: "tenant" })).toMatch(/landlord accounts/i);
  });

  it("keeps phone and fee prerequisites enabled", () => {
    expect(validateLandlordVerification({ ...validInput, verificationFeePaid: false })).toMatch(/verification fee/i);
    expect(validateLandlordVerification({ ...validInput, phoneVerified: false })).toMatch(/verify your phone/i);
  });

  it("requires the registered name and an applicant name-match confirmation", () => {
    expect(validateLandlordVerification({ ...validInput, registeredName: " " })).toMatch(/account name/i);
    expect(validateLandlordVerification({ ...validInput, nameMatchConfirmed: false })).toMatch(/matches your registered name/i);
  });

  it("requires both an ID document and a selfie", () => {
    expect(validateLandlordVerification({ ...validInput, idFile: null })).toMatch(/ID document/i);
    expect(validateLandlordVerification({ ...validInput, selfieFile: null })).toMatch(/selfie holding your ID/i);
  });

  it("allows PDF for an ID but requires the selfie to be an image", () => {
    expect(validateLandlordVerification({ ...validInput, idFile: { type: "application/pdf", size: 1024 } })).toBeNull();
    expect(validateLandlordVerification({ ...validInput, selfieFile: { type: "application/pdf", size: 1024 } })).toMatch(/selfie as a JPG/i);
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateLandlordVerification({ ...validInput, idFile: { type: "text/plain", size: 1024 } })).toMatch(/JPG, PNG, WebP, or PDF/i);
    expect(validateLandlordVerification({ ...validInput, selfieFile: { type: "image/png", size: MAX_VERIFICATION_FILE_SIZE + 1 } })).toMatch(/smaller than 10 MB/i);
  });
});
