export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024;

export type VerificationFile = Pick<File, "type" | "size">;

export type LandlordVerificationInput = {
  accountType: string | null | undefined;
  verificationFeePaid: boolean;
  phoneVerified: boolean;
  registeredName: string | null | undefined;
  nameMatchConfirmed: boolean;
  idFile: VerificationFile | null;
  selfieFile: VerificationFile | null;
};

const idMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const selfieMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateLandlordVerification(input: LandlordVerificationInput): string | null {
  if (input.accountType !== "landlord") return "Landlord verification is only available to landlord accounts.";
  if (!input.verificationFeePaid) return "Pay the one-time ₦1,500 NIN verification fee before submitting your NIN.";
  if (!input.phoneVerified) return "Verify your phone number before submitting your NIN.";
  if (!input.registeredName?.trim()) return "Your account name is required for identity verification.";
  if (!input.nameMatchConfirmed) return "Confirm that the name on your ID matches your registered name.";
  if (!input.idFile) return "Please upload a photo or scan of your ID document.";
  if (!idMimeTypes.has(input.idFile.type)) return "Upload your ID as a JPG, PNG, WebP, or PDF file.";
  if (input.idFile.size <= 0 || input.idFile.size > MAX_VERIFICATION_FILE_SIZE) return "Each verification file must be smaller than 10 MB.";
  if (!input.selfieFile) return "Please upload a selfie holding your ID.";
  if (!selfieMimeTypes.has(input.selfieFile.type)) return "Upload your selfie as a JPG, PNG, or WebP image.";
  if (input.selfieFile.size <= 0 || input.selfieFile.size > MAX_VERIFICATION_FILE_SIZE) return "Each verification file must be smaller than 10 MB.";
  return null;
}
