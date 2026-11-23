-- Let users change their tenant/landlord role from profile settings while keeping
-- approval, blocking, verification, and other protected fields server controlled.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
      NEW.approval_status := 'pending';
      NEW.rejection_reason := NULL;
      NEW.approved_at := NULL;
      NEW.is_blocked := false;
      NEW.verification_status := 'unverified';
      NEW.agency_verified := false;
      NEW.verified_at := NULL;
      NEW.account_review_required := false;
      NEW.verification_fee_paid := false;
      NEW.phone_verified_at := NULL;
    END IF;
    RETURN NEW;
  END IF;

  IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.agency_verified := OLD.agency_verified;
    NEW.verified_at := OLD.verified_at;
    NEW.account_review_required := OLD.account_review_required;
    NEW.verification_fee_paid := OLD.verification_fee_paid;
    NEW.phone_verified_at := OLD.phone_verified_at;
    NEW.approval_status := OLD.approval_status;
    NEW.rejection_reason := OLD.rejection_reason;
    NEW.approved_at := OLD.approved_at;
    NEW.is_blocked := OLD.is_blocked;

    IF NEW.account_type IN ('tenant', 'landlord') THEN
      NEW.role_selected := true;
    ELSE
      NEW.role_selected := OLD.role_selected;
      NEW.account_type := OLD.account_type;
    END IF;

    IF OLD.account_type = 'tenant' AND NEW.account_type = 'landlord' THEN
      -- Tenant verification is free; require landlord verification before posting.
      NEW.verification_status := 'unverified';
      NEW.verification_fee_paid := false;
      NEW.verification_name_matched := false;
    END IF;

    IF OLD.phone_verified_at IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.phone := OLD.phone;
    END IF;
    IF NOT (OLD.account_type = 'tenant' AND NEW.account_type = 'landlord')
      AND (NEW.verification_status NOT IN ('pending') OR OLD.verification_status = 'approved') THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

-- Agents use the landlord account type with professional_type = agent_realtor.
CREATE OR REPLACE FUNCTION public.is_verified_landlord(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = _owner AND p.account_type = 'landlord'
      AND p.verification_status = 'approved' AND p.approval_status = 'approved'
      AND NOT p.is_blocked AND NOT p.account_review_required
      AND (p.professional_type IS NULL OR p.professional_type IN ('property_owner', 'agent_realtor'))
  ) OR EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = _owner AND lower(u.email) = 'rentreadyng@gmail.com'
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_landlord(uuid) TO anon, authenticated;

-- The admin can post from their own account even if its profile is still a tenant
-- or has not completed landlord verification. Other accounts keep existing checks.
DROP POLICY IF EXISTS "owner insert" ON public.listings;
CREATE POLICY "owner insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = owner_id AND (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.profile_can_act(auth.uid())
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.id = auth.uid() AND p.account_type = 'landlord' AND p.verification_status = 'approved'
      )
    )
  )
);
