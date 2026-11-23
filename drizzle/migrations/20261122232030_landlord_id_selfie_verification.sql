ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS selfie_document_path text,
  ADD COLUMN IF NOT EXISTS verification_name_matched boolean NOT NULL DEFAULT false;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_id_document_path_owner_check,
  ADD CONSTRAINT profiles_id_document_path_owner_check
    CHECK (id_document_path IS NULL OR split_part(id_document_path, '/', 1) = id::text),
  DROP CONSTRAINT IF EXISTS profiles_selfie_document_path_owner_check,
  ADD CONSTRAINT profiles_selfie_document_path_owner_check
    CHECK (selfie_document_path IS NULL OR split_part(selfie_document_path, '/', 1) = id::text);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'id-documents',
  'id-documents',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO UPDATE
SET public = false,
    file_size_limit = 10485760,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

DROP POLICY IF EXISTS "Users upload own ID docs" ON storage.objects;
CREATE POLICY "Users upload own ID docs"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Users read own ID docs" ON storage.objects;
CREATE POLICY "Users read own ID docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

DROP POLICY IF EXISTS "Admins read ID docs" ON storage.objects;
CREATE POLICY "Admins read ID docs"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'id-documents'
    AND public.has_role((SELECT auth.uid()), 'admin')
  );

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
    -- Only the review team can record the manual name comparison.
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
      IF NEW.id_document_path IS NULL OR NEW.selfie_document_path IS NULL THEN
        RAISE EXCEPTION 'Both an ID document and a selfie are required';
      END IF;
      IF NEW.id_number !~ '^\d{11}$' THEN
        RAISE EXCEPTION 'A valid 11-digit NIN is required';
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
      RAISE EXCEPTION 'A landlord ID, selfie, and confirmed name match are required for approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS zz_guard_landlord_verification_submission ON public.profiles;
CREATE TRIGGER zz_guard_landlord_verification_submission
  BEFORE INSERT OR UPDATE OF verification_status, id_document_path, selfie_document_path, verification_name_matched
  ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_landlord_verification_submission();

REVOKE EXECUTE ON FUNCTION public.guard_landlord_verification_submission() FROM PUBLIC, anon, authenticated;
