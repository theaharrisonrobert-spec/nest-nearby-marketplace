-- Identity documents can be uploaded before a landlord pays. Tenants submit for free.
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
      IF NEW.id_document_path IS NULL OR NEW.selfie_document_path IS NULL THEN
        RAISE EXCEPTION 'Both an ID document and a selfie are required';
      END IF;
      IF NEW.id_number IS NULL OR NEW.id_number !~ '^\d{11}$' THEN
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
      RAISE EXCEPTION 'An ID, selfie, and confirmed name match are required for identity approval';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.guard_landlord_verification_submission() FROM PUBLIC, anon, authenticated;

-- The tenant test alias is always created as a tenant, even if stale auth metadata says landlord.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_role text := lower(coalesce(
    nullif(NEW.raw_user_meta_data->>'account_type', ''),
    nullif(NEW.raw_user_meta_data->>'role', '')
  ));
  profile_role text;
BEGIN
  profile_role := CASE
    WHEN lower(NEW.email) = 'rentreadyng+tenant-test@gmail.com' THEN 'tenant'
    WHEN signup_role IN ('landlord', 'agent') THEN 'landlord'
    ELSE 'tenant'
  END;

  INSERT INTO public.profiles (
    id, full_name, phone, account_type, role_selected,
    professional_type, property_location, property_count
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    profile_role,
    lower(coalesce(NEW.raw_user_meta_data->>'account_type', NEW.raw_user_meta_data->>'role', '')) IN ('landlord', 'agent', 'tenant'),
    NEW.raw_user_meta_data->>'professional_type',
    NEW.raw_user_meta_data->>'property_location',
    NEW.raw_user_meta_data->>'property_count'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Correct the existing test user and auth metadata. The profile guard intentionally freezes
-- user-selected roles, so this trusted migration marks the update as service-role work.
SELECT set_config('request.jwt.claim.role', 'service_role', true);
UPDATE auth.users
SET raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb)
  || jsonb_build_object('account_type', 'tenant', 'role', 'tenant', 'role_selected', true)
WHERE lower(email) = 'rentreadyng+tenant-test@gmail.com';

UPDATE public.profiles p
SET account_type = 'tenant', role_selected = true
FROM auth.users u
WHERE u.id = p.id
  AND lower(u.email) = 'rentreadyng+tenant-test@gmail.com';

SELECT set_config('request.jwt.claim.role', '', true);
