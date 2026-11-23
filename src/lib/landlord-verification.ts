export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024;

export type VerificationFile = Pick<File, "type" | "size">;

export type VerificationUploadInput = {
  accountType: string | null | undefined;
  registeredName: string | null | undefined;
  nin: string;
  idFile: VerificationFile | null;
  selfieFile: VerificationFile | null;
};

const idMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const selfieMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

export function validateVerificationUploads(input: VerificationUploadInput): string | null {
  if (input.accountType !== "landlord" && input.accountType !== "tenant") return "Choose Tenant or Landlord before submitting identity verification.";
  if (!/^\d{11}$/.test(input.nin)) return "Enter a valid 11-digit NIN.";
  if (!input.registeredName?.trim()) return "Add your name to your account before identity review.";
  if (!input.idFile) return "Please upload a photo or scan of your ID document.";
  if (!idMimeTypes.has(input.idFile.type)) return "Upload your ID as a JPG, PNG, WebP, or PDF file.";
  if (input.idFile.size <= 0 || input.idFile.size > MAX_VERIFICATION_FILE_SIZE) return "Each verification file must be smaller than 10 MB.";
  if (!input.selfieFile) return "Please upload a selfie holding your ID.";
  if (!selfieMimeTypes.has(input.selfieFile.type)) return "Upload your selfie as a JPG, PNG, or WebP image.";
  if (input.selfieFile.size <= 0 || input.selfieFile.size > MAX_VERIFICATION_FILE_SIZE) return "Each verification file must be smaller than 10 MB.";
  return null;
}
