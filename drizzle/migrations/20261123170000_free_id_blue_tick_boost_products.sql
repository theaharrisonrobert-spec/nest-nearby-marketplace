-- Free landlord identity verification plus Blue Tick and per-listing Boost products.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS blue_tick_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS blue_tick_id_document_path text,
  ADD COLUMN IF NOT EXISTS blue_tick_selfie_path text,
  ADD COLUMN IF NOT EXISTS blue_tick_submitted_at timestamptz,
  ADD CONSTRAINT profiles_blue_tick_status_check
    CHECK (blue_tick_status IN ('unverified', 'pending', 'approved', 'rejected'));

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_blue_tick_id_path_owner_check
    CHECK (blue_tick_id_document_path IS NULL OR split_part(blue_tick_id_document_path, '/', 1) = id::text),
  ADD CONSTRAINT profiles_blue_tick_selfie_path_owner_check
    CHECK (blue_tick_selfie_path IS NULL OR split_part(blue_tick_selfie_path, '/', 1) = id::text);

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS boosted_until timestamptz;
GRANT SELECT (boosted_until) ON public.listings TO anon, authenticated;

ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_plan_check;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
  CHECK (plan IN ('landlord_premium', 'tenant_premium', 'featured_listing', 'nin_verification', 'blue_tick_monthly', 'boost_post'));

-- Legacy identity payments remain historical rows only; new checkouts cannot create them.
UPDATE public.subscriptions SET status = 'cancelled'
WHERE plan = 'nin_verification' AND status = 'pending';

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
    IF NOT is_admin AND NOT is_service_role THEN NEW.verification_name_matched := false; END IF;
    RETURN NEW;
  END IF;

  is_new_submission := NEW.verification_status = 'pending'
    AND (OLD.verification_status IS DISTINCT FROM NEW.verification_status
      OR OLD.id_document_path IS DISTINCT FROM NEW.id_document_path
      OR OLD.selfie_document_path IS DISTINCT FROM NEW.selfie_document_path);

  IF NOT is_admin AND NOT is_service_role THEN
    NEW.verification_name_matched := OLD.verification_name_matched;
    IF is_new_submission THEN
      IF NEW.account_type NOT IN ('tenant', 'landlord') THEN RAISE EXCEPTION 'Choose Tenant or Landlord before submitting identity verification'; END IF;
      IF NULLIF(btrim(NEW.full_name), '') IS NULL THEN RAISE EXCEPTION 'A registered name is required for verification'; END IF;
      IF NEW.id_type NOT IN ('National ID (NIN)', 'Driver''s License', 'International Passport', 'Voter''s Card (PVC)', 'National Identity Card') THEN
        RAISE EXCEPTION 'Choose a valid identity document type';
      END IF;
      IF NEW.id_number IS NULL OR ((NEW.id_type = 'National ID (NIN)' AND NEW.id_number !~ '^\d{11}$')
        OR (NEW.id_type <> 'National ID (NIN)' AND NEW.id_number !~ '^[A-Za-z0-9 /-]{4,32}$')) THEN
        RAISE EXCEPTION 'Enter a valid number for the selected identity document';
      END IF;
      IF NEW.id_document_path IS NULL OR NEW.selfie_document_path IS NULL THEN RAISE EXCEPTION 'Both an ID document and a selfie are required'; END IF;
      IF split_part(NEW.id_document_path, '/', 1) <> NEW.id::text OR split_part(NEW.selfie_document_path, '/', 1) <> NEW.id::text THEN
        RAISE EXCEPTION 'Verification files must be stored in the account owner folder';
      END IF;
    END IF;
  ELSIF NEW.verification_status = 'approved' AND OLD.verification_status IS DISTINCT FROM 'approved' THEN
    IF NEW.account_type NOT IN ('tenant', 'landlord') OR NEW.id_document_path IS NULL OR NEW.selfie_document_path IS NULL
      OR NEW.verification_name_matched IS DISTINCT FROM true THEN
      RAISE EXCEPTION 'An ID, selfie, and confirmed name match are required for identity approval';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.guard_landlord_verification_submission() FROM PUBLIC, anon, authenticated;

-- Account owners may submit Blue Tick documents only after free ID approval and an active paid plan.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  trusted boolean := public.has_role(auth.uid(), 'admin') OR current_setting('request.jwt.claim.role', true) = 'service_role';
  blue_tick_submission boolean;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT trusted THEN
      NEW.approval_status := 'pending'; NEW.rejection_reason := NULL; NEW.approved_at := NULL; NEW.is_blocked := false;
      NEW.verification_status := 'unverified'; NEW.agency_verified := false; NEW.verified_at := NULL;
      NEW.account_review_required := false; NEW.verification_fee_paid := false; NEW.phone_verified_at := NULL;
      NEW.blue_tick_status := 'unverified'; NEW.blue_tick_id_document_path := NULL; NEW.blue_tick_selfie_path := NULL;
      NEW.blue_tick_submitted_at := NULL;
    END IF;
    RETURN NEW;
  END IF;
  IF NOT trusted THEN
    NEW.agency_verified := OLD.agency_verified; NEW.verified_at := OLD.verified_at;
    NEW.account_review_required := OLD.account_review_required; NEW.verification_fee_paid := OLD.verification_fee_paid;
    NEW.phone_verified_at := OLD.phone_verified_at; NEW.approval_status := OLD.approval_status;
    NEW.rejection_reason := OLD.rejection_reason; NEW.approved_at := OLD.approved_at; NEW.is_blocked := OLD.is_blocked;
    IF NEW.account_type IN ('tenant', 'landlord') THEN NEW.role_selected := true;
    ELSE NEW.role_selected := OLD.role_selected; NEW.account_type := OLD.account_type; END IF;
    IF OLD.account_type = 'tenant' AND NEW.account_type = 'landlord' THEN
      NEW.verification_status := 'unverified'; NEW.verification_fee_paid := false; NEW.verification_name_matched := false;
    END IF;
    IF OLD.phone_verified_at IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.phone := OLD.phone; END IF;
    IF NOT (OLD.account_type = 'tenant' AND NEW.account_type = 'landlord')
      AND (NEW.verification_status NOT IN ('pending') OR OLD.verification_status = 'approved') THEN NEW.verification_status := OLD.verification_status; END IF;

    blue_tick_submission := NEW.blue_tick_status = 'pending' AND OLD.blue_tick_status IN ('unverified', 'rejected', 'approved')
      AND NEW.blue_tick_id_document_path IS NOT NULL AND NEW.blue_tick_selfie_path IS NOT NULL
      AND split_part(NEW.blue_tick_id_document_path, '/', 1) = OLD.id::text
      AND split_part(NEW.blue_tick_selfie_path, '/', 1) = OLD.id::text
      AND OLD.verification_status = 'approved'
      AND EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = OLD.id AND s.plan = 'blue_tick_monthly'
        AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now()));
    IF blue_tick_submission THEN
      NEW.blue_tick_submitted_at := now();
    ELSE
      NEW.blue_tick_status := OLD.blue_tick_status;
      NEW.blue_tick_id_document_path := OLD.blue_tick_id_document_path;
      NEW.blue_tick_selfie_path := OLD.blue_tick_selfie_path;
      NEW.blue_tick_submitted_at := OLD.blue_tick_submitted_at;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.protect_boosted_until()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN NEW.boosted_until := NULL; ELSE NEW.boosted_until := OLD.boosted_until; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER protect_boosted_until BEFORE INSERT OR UPDATE ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.protect_boosted_until();

CREATE OR REPLACE FUNCTION public.apply_paystack_payment(_subscription_id uuid, _charge_reference text, _amount_kobo bigint, _recurring boolean)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE payment public.subscriptions%ROWTYPE; now_at timestamptz := now(); period_end timestamptz; previous_role text;
BEGIN
  SELECT * INTO payment FROM public.subscriptions WHERE id = _subscription_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Subscription not found'; END IF;
  IF payment.amount_ngn::bigint * 100 <> _amount_kobo THEN RAISE EXCEPTION 'Payment amount mismatch'; END IF;
  INSERT INTO public.payment_event_refs(provider_reference, subscription_id) VALUES (_charge_reference, payment.id)
    ON CONFLICT (provider_reference) DO NOTHING;
  IF NOT FOUND THEN RETURN false; END IF;

  IF payment.plan IN ('landlord_premium', 'tenant_premium', 'blue_tick_monthly') THEN
    period_end := CASE WHEN _recurring AND payment.ends_at > now_at THEN payment.ends_at + interval '30 days' ELSE now_at + interval '30 days' END;
  END IF;
  UPDATE public.subscriptions SET status = 'active', starts_at = coalesce(starts_at, now_at), ends_at = period_end,
    cancel_at_period_end = false, last_charge_reference = _charge_reference WHERE id = payment.id;

  previous_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF payment.plan = 'boost_post' AND payment.listing_id IS NOT NULL THEN
    UPDATE public.listings SET boosted_until = now_at + interval '7 days'
      WHERE id = payment.listing_id AND owner_id = payment.user_id AND status = 'approved';
  ELSIF payment.plan = 'featured_listing' AND payment.listing_id IS NOT NULL THEN
    UPDATE public.listings SET featured_until = now_at + interval '7 days'
      WHERE id = payment.listing_id AND owner_id = payment.user_id AND status = 'approved';
  END IF;
  PERFORM set_config('request.jwt.claim.role', coalesce(previous_role, 'service_role'), true);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_paystack_payment(uuid, text, bigint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paystack_payment(uuid, text, bigint, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.is_blue_tick_verified(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p JOIN public.subscriptions s ON s.user_id = p.id
    WHERE p.id = _owner AND p.verification_status = 'approved' AND p.blue_tick_status = 'approved'
      AND s.plan = 'blue_tick_monthly' AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_blue_tick_verified(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.blue_tick_owner_ids(_owners uuid[])
RETURNS TABLE(owner_id uuid) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id FROM public.profiles p JOIN public.subscriptions s ON s.user_id = p.id
  WHERE p.id = ANY(_owners) AND p.verification_status = 'approved' AND p.blue_tick_status = 'approved'
    AND s.plan = 'blue_tick_monthly' AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
$$;
GRANT EXECUTE ON FUNCTION public.blue_tick_owner_ids(uuid[]) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.owner_badges(_owner uuid)
RETURNS TABLE(account_type text, identity_verified boolean, agency_verified boolean, agency_name text, blue_tick_verified boolean)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.account_type, p.verification_status = 'approved', p.agency_verified, p.agency_name, public.is_blue_tick_verified(p.id)
  FROM public.profiles p WHERE p.id = _owner
$$;
GRANT EXECUTE ON FUNCTION public.owner_badges(uuid) TO anon, authenticated;
