export const MAX_VERIFICATION_FILE_SIZE = 10 * 1024 * 1024;

export type VerificationFile = Pick<File, "type" | "size">;

export type VerificationUploadInput = {
  accountType: string | null | undefined;
  registeredName: string | null | undefined;
  idType: string;
  idNumber: string;
  idFile: VerificationFile | null;
  selfieFile: VerificationFile | null;
};

const idMimeTypes = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);
const selfieMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const landlordIdTypes = ["National ID (NIN)", "Driver's License", "International Passport", "Voter's Card (PVC)", "National Identity Card"];
const tenantIdTypes = ["National ID (NIN)", "Driver's License", "Voter's Card (PVC)", "International Passport"];

export function validateVerificationUploads(input: VerificationUploadInput): string | null {
  if (input.accountType !== "landlord" && input.accountType !== "tenant") return "Choose Tenant or Landlord before submitting identity verification.";
  const allowedIdTypes = input.accountType === "tenant" ? tenantIdTypes : landlordIdTypes;
  if (!allowedIdTypes.includes(input.idType)) return "Choose a valid ID type.";
  if (input.idType === "National ID (NIN)" ? !/^\d{11}$/.test(input.idNumber) : !/^[A-Za-z0-9 /-]{4,32}$/.test(input.idNumber)) {
    return input.idType === "National ID (NIN)" ? "Enter a valid 11-digit NIN." : "Enter a valid ID number (4–32 letters or numbers).";
  }
  if (!input.registeredName?.trim()) return "Add your name to your account before identity review.";
  if (!input.idFile) return "Please upload a photo or scan of your ID document.";
  if (!idMimeTypes.has(input.idFile.type)) return "Upload your ID as a JPG, PNG, WebP, or PDF file.";
  if (input.idFile.size <= 0 || input.idFile.size > MAX_VERIFICATION_FILE_SIZE) return "The ID file must be smaller than 10 MB.";

  if (input.accountType === "landlord") {
    if (!input.selfieFile) return "Please upload a selfie holding your ID.";
    if (!selfieMimeTypes.has(input.selfieFile.type)) return "Upload your selfie as a JPG, PNG, or WebP image.";
    if (input.selfieFile.size <= 0 || input.selfieFile.size > MAX_VERIFICATION_FILE_SIZE) return "The selfie file must be smaller than 10 MB.";
  }
  return null;
}