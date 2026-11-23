import { describe, expect, it } from "vitest";
import { MAX_VERIFICATION_FILE_SIZE, validateVerificationUploads, type VerificationUploadInput } from "@/lib/landlord-verification";

const validInput: VerificationUploadInput = {
  accountType: "landlord",
  registeredName: "Alex Sample",
  idType: "National ID (NIN)",
  idNumber: "12345678901",
  idFile: { type: "image/png", size: 1024 },
  selfieFile: { type: "image/jpeg", size: 2048 },
};

describe("identity verification upload validation", () => {
  it("accepts tenant and landlord uploads without a phone or payment prerequisite", () => {
    expect(validateVerificationUploads(validInput)).toBeNull();
    expect(validateVerificationUploads({ ...validInput, accountType: "tenant" })).toBeNull();
  });

  it("rejects accounts without a selected role and invalid NINs", () => {
    expect(validateVerificationUploads({ ...validInput, accountType: "" })).toMatch(/Choose Tenant or Landlord/i);
    expect(validateVerificationUploads({ ...validInput, idType: "National ID (NIN)", idNumber: "123" })).toMatch(/11-digit NIN/i);
  });

  it("requires the registered name", () => {
    expect(validateVerificationUploads({ ...validInput, registeredName: " " })).toMatch(/name to your account/i);
  });

  it("requires both an ID document and a selfie", () => {
    expect(validateVerificationUploads({ ...validInput, idFile: null })).toMatch(/ID document/i);
    expect(validateVerificationUploads({ ...validInput, selfieFile: null })).toMatch(/selfie holding your ID/i);
  });

  it("allows PDF for an ID but requires the selfie to be an image", () => {
    expect(validateVerificationUploads({ ...validInput, idFile: { type: "application/pdf", size: 1024 } })).toBeNull();
    expect(validateVerificationUploads({ ...validInput, selfieFile: { type: "application/pdf", size: 1024 } })).toMatch(/selfie as a JPG/i);
  });

  it("rejects unsupported and oversized files", () => {
    expect(validateVerificationUploads({ ...validInput, idFile: { type: "text/plain", size: 1024 } })).toMatch(/JPG, PNG, WebP, or PDF/i);
    expect(validateVerificationUploads({ ...validInput, selfieFile: { type: "image/png", size: MAX_VERIFICATION_FILE_SIZE + 1 } })).toMatch(/smaller than 10 MB/i);
  });
});
