-- Allow the supported Nigerian identity document types in manual verification.
CREATE OR REPLACE FUNCTION public.guard_landlord_verification_submission()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := public.has_role(auth.uid(), 'admin');
  is_service_role boolean := current_setting('request.jwt.claim.role', true) = 'service_role';
  is_new_submission boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT is_admin AND NOT is_service_role THEN
      NEW.verification_name_matched := false;
    END IF;
    RETURN NEW;
  END IF;

  is_new_submission := NEW.verification_status = 'pending'
    AND (
      OLD.verification_status IS DISTINCT FROM NEW.verification_status
      OR OLD.id_document_path IS DISTINCT FROM NEW.id_document_path
      OR OLD.selfie_document_path IS DISTINCT FROM NEW.selfie_document_path
    );

  IF NOT is_admin AND NOT is_service_role THEN
    NEW.verification_name_matched := OLD.verification_name_matched;

    IF is_new_submission THEN
      IF NEW.account_type NOT IN ('tenant', 'landlord') THEN
        RAISE EXCEPTION 'Choose Tenant or Landlord before submitting identity verification';
      END IF;
      IF NEW.account_type = 'landlord' AND NOT NEW.verification_fee_paid THEN
        RAISE EXCEPTION 'RentReady Verification Fee must be confirmed before landlord submission';
      END IF;
      IF NULLIF(btrim(NEW.full_name), '') IS NULL THEN
        RAISE EXCEPTION 'A registered name is required for verification';
      END IF;
      IF NEW.id_type NOT IN (
        'National ID (NIN)', 'Driver''s License', 'International Passport',
        'Voter''s Card (PVC)', 'National Identity Card'
      ) THEN
        RAISE EXCEPTION 'Choose a valid identity document type';
      END IF;
      IF NEW.id_number IS NULL OR (
        (NEW.id_type = 'National ID (NIN)' AND NEW.id_number !~ '^\d{11}$')
        OR (NEW.id_type <> 'National ID (NIN)' AND NEW.id_number !~ '^[A-Za-z0-9 /-]{4,32}$')
      ) THEN
        RAISE EXCEPTION 'Enter a valid number for the selected identity document';
      END IF;
      IF NEW.id_document_path IS NULL OR NEW.selfie_document_path IS NULL THEN
        RAISE EXCEPTION 'Both an ID document and a selfie are required';
      END IF;
      IF split_part(NEW.id_document_path, '/', 1) <> NEW.id::text
         OR split_part(NEW.selfie_document_path, '/', 1) <> NEW.id::text THEN
        RAISE EXCEPTION 'Verification files must be stored in the account owner folder';
      END IF;
    END IF;
  ELSIF NEW.verification_status = 'approved'
    AND OLD.verification_status IS DISTINCT FROM 'approved' THEN
    IF NEW.account_type NOT IN ('tenant', 'landlord')
       OR NEW.id_document_path IS NULL
       OR NEW.selfie_document_path IS NULL
       OR NEW.verification_name_matched IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'An ID, selfie, and confirmed name match are required for identity approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_landlord_verification_submission() FROM PUBLIC, anon, authenticated;
