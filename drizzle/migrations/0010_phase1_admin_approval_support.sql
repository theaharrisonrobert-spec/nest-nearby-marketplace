-- New accounts start in a review queue; existing accounts keep their current access.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS rejection_reason text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_blocked boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_approval_status_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_approval_status_check
  CHECK (approval_status IN ('pending','approved','rejected'));
UPDATE public.profiles SET approval_status = 'approved', approved_at = COALESCE(approved_at, created_at)
WHERE approval_status = 'pending';

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS availability_status text NOT NULL DEFAULT 'available',
  ADD COLUMN IF NOT EXISTS rejection_reason text;
UPDATE public.listings SET availability_status = 'rented' WHERE status = 'unavailable';
ALTER TABLE public.listings DROP CONSTRAINT IF EXISTS listings_availability_status_check;
ALTER TABLE public.listings ADD CONSTRAINT listings_availability_status_check
  CHECK (availability_status IN ('available','pending','rented','expired'));
GRANT SELECT (availability_status) ON public.listings TO anon, authenticated;
GRANT SELECT (rejection_reason) ON public.listings TO anon, authenticated;
GRANT UPDATE (availability_status) ON public.listings TO authenticated;

-- The configured founder email, rather than an editable role row, is the sole admin identity.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN _role = 'admin'::public.app_role THEN
    _user_id = auth.uid() AND EXISTS (
      SELECT 1 FROM auth.users u WHERE u.id = _user_id AND lower(u.email) = 'rentreadyng@gmail.com'
    )
  ELSE EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _user_id AND r.role = _role)
  END
$$;

CREATE OR REPLACE FUNCTION public.profile_can_act(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _user_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _user_id
      AND p.approval_status = 'approved' AND NOT p.is_blocked
  )
$$;
REVOKE EXECUTE ON FUNCTION public.profile_can_act(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.profile_can_act(uuid) TO authenticated;

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
    IF OLD.role_selected OR NOT NEW.role_selected OR NEW.account_type NOT IN ('tenant','landlord') THEN
      NEW.role_selected := OLD.role_selected;
      NEW.account_type := OLD.account_type;
    END IF;
    IF OLD.phone_verified_at IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN NEW.phone := OLD.phone; END IF;
    IF NEW.verification_status NOT IN ('pending') OR OLD.verification_status = 'approved' THEN NEW.verification_status := OLD.verification_status; END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- Admin console must be able to review and update people outside the owner's own profile.
CREATE POLICY "founder reads all profiles" ON public.profiles FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "founder updates profiles" ON public.profiles FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.protect_listing_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending';
      NEW.availability_status := 'available';
      NEW.sponsored := false;
      NEW.details_reviewed := false;
      NEW.is_sample := false;
      NEW.featured_until := NULL;
      NEW.early_access_until := NULL;
    ELSE
      NEW.sponsored := OLD.sponsored;
      NEW.details_reviewed := OLD.details_reviewed;
      NEW.is_sample := OLD.is_sample;
      NEW.featured_until := OLD.featured_until;
      NEW.early_access_until := OLD.early_access_until;
      IF NOT public.profile_can_act(auth.uid()) THEN NEW.availability_status := OLD.availability_status; END IF;
      IF (to_jsonb(NEW) - 'promotion_requested' - 'availability_status') = (to_jsonb(OLD) - 'promotion_requested' - 'availability_status') THEN
        NEW.status := OLD.status;
      ELSE
        NEW.status := CASE WHEN NEW.status = 'unavailable' THEN OLD.status ELSE 'pending' END;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'approved' AND NEW.status = 'approved' THEN
    NEW.early_access_until := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.is_verified_landlord(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = _owner AND p.account_type = 'landlord'
      AND p.verification_status = 'approved' AND p.approval_status = 'approved'
      AND NOT p.is_blocked AND NOT p.account_review_required
      AND (p.professional_type IS NULL OR p.professional_type = 'property_owner')
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_landlord(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "owner insert" ON public.listings;
CREATE POLICY "owner insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = owner_id AND public.profile_can_act(auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.account_type = 'landlord' AND p.verification_status = 'approved')
);
DROP POLICY IF EXISTS "listings public read" ON public.listings;
CREATE POLICY "listings public read" ON public.listings FOR SELECT USING (
  status = 'approved' AND availability_status = 'available' AND NOT is_sample
  AND public.is_verified_landlord(owner_id)
  AND (public.is_verified_premium_landlord(owner_id) OR id = public.first_free_landlord_listing(owner_id))
  AND (early_access_until IS NULL OR early_access_until <= now() OR owner_id = auth.uid()
    OR public.has_role(auth.uid(), 'admin') OR public.current_user_has_tenant_premium())
);

DROP POLICY IF EXISTS "send as self" ON public.messages;
CREATE POLICY "send as self" ON public.messages FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = sender_id AND sender_id <> recipient_id AND public.profile_can_act(auth.uid())
);
DROP POLICY IF EXISTS "request viewing" ON public.viewings;
CREATE POLICY "request viewing" ON public.viewings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = requester_id AND requester_id <> owner_id AND status = 'requested'
  AND public.profile_can_act(auth.uid())
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified_at IS NOT NULL)
  AND public.is_verified_landlord(owner_id)
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = public.viewings.owner_id
    AND l.status = 'approved' AND l.availability_status = 'available' AND NOT l.is_sample)
);
DROP POLICY IF EXISTS "report as self" ON public.reports;
CREATE POLICY "report as self" ON public.reports FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = reporter_id AND public.profile_can_act(auth.uid()));

CREATE TABLE public.support_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  contact_email text CHECK (contact_email IS NULL OR char_length(contact_email) <= 320),
  category text NOT NULL CHECK (category IN ('Report listing','Report scam','Payment','Login','Landlord not responding','Other')),
  details text NOT NULL CHECK (char_length(details) BETWEEN 3 AND 2000),
  page_url text CHECK (page_url IS NULL OR char_length(page_url) <= 1000),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved')),
  created_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz
);
GRANT INSERT ON public.support_tickets TO anon, authenticated;
GRANT SELECT, UPDATE ON public.support_tickets TO authenticated;
ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "visitors create support tickets" ON public.support_tickets FOR INSERT TO anon, authenticated
  WITH CHECK (status = 'open' AND resolved_at IS NULL AND (user_id IS NULL OR user_id = auth.uid()));
CREATE POLICY "founder reads support tickets" ON public.support_tickets FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "founder resolves support tickets" ON public.support_tickets FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.admin_user_directory(_search text DEFAULT NULL)
RETURNS TABLE (
  id uuid, email text, full_name text, phone text, account_type text,
  approval_status text, rejection_reason text, is_blocked boolean, created_at timestamptz
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY SELECT p.id, u.email::text, p.full_name, p.phone, p.account_type,
    p.approval_status, p.rejection_reason, p.is_blocked, p.created_at
  FROM public.profiles p JOIN auth.users u ON u.id = p.id
  WHERE _search IS NULL OR btrim(_search) = '' OR u.email ILIKE '%' || btrim(_search) || '%'
    OR p.full_name ILIKE '%' || btrim(_search) || '%'
  ORDER BY p.created_at DESC LIMIT 500;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_user_directory(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_user_directory(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_premium_subscriptions()
RETURNS TABLE (user_email text, full_name text, plan text, status text, amount_ngn numeric, created_at timestamptz, ends_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  RETURN QUERY
    SELECT u.email::text, p.full_name, s.plan, s.status, s.amount_ngn::numeric, s.created_at, s.ends_at
      FROM public.subscriptions s JOIN auth.users u ON u.id = s.user_id LEFT JOIN public.profiles p ON p.id = s.user_id
      WHERE s.plan IN ('landlord_premium','tenant_premium')
    UNION ALL
    SELECT ts.email, p.full_name, ts.plan, ts.status, ts.amount::numeric / 100, ts.created_at, ts.current_period_end
      FROM public.tenant_subscriptions ts LEFT JOIN public.profiles p ON p.id = ts.user_id
    ORDER BY created_at DESC LIMIT 500;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_premium_subscriptions() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_premium_subscriptions() TO authenticated;

CREATE OR REPLACE FUNCTION public.admin_dashboard_stats()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE result jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Admins only'; END IF;
  SELECT jsonb_build_object(
    'total_users', (SELECT count(*) FROM public.profiles),
    'landlords', (SELECT count(*) FROM public.profiles WHERE account_type = 'landlord'),
    'tenants', (SELECT count(*) FROM public.profiles WHERE account_type = 'tenant'),
    'pending_approvals', (SELECT count(*) FROM public.profiles WHERE approval_status = 'pending'),
    'available_listings', (SELECT count(*) FROM public.listings WHERE status = 'approved' AND availability_status = 'available' AND NOT is_sample),
    'pending_listings', (SELECT count(*) FROM public.listings WHERE status = 'pending' AND NOT is_sample),
    'rented_listings', (SELECT count(*) FROM public.listings WHERE availability_status = 'rented' AND NOT is_sample),
    'expired_listings', (SELECT count(*) FROM public.listings WHERE availability_status = 'expired' AND NOT is_sample),
    'signups_today', (SELECT count(*) FROM public.profiles WHERE created_at >= date_trunc('day', now())),
    'listings_today', (SELECT count(*) FROM public.listings WHERE created_at >= date_trunc('day', now()) AND NOT is_sample),
    'premium_today', (SELECT count(*) FROM public.subscriptions WHERE created_at >= date_trunc('day', now()) AND status = 'active'
       AND plan IN ('landlord_premium','tenant_premium')) +
       (SELECT count(*) FROM public.tenant_subscriptions WHERE created_at >= date_trunc('day', now()) AND status = 'active'),
    'monthly_revenue_ngn', COALESCE((SELECT sum(amount_ngn) FROM public.subscriptions WHERE status = 'active'
       AND plan IN ('landlord_premium','tenant_premium')), 0) +
       COALESCE((SELECT sum(amount::numeric / 100) FROM public.tenant_subscriptions WHERE status = 'active'
       AND current_period_end > now()), 0),
    'open_support_tickets', (SELECT count(*) FROM public.support_tickets WHERE status = 'open')
  ) INTO result;
  RETURN result;
END $$;
REVOKE EXECUTE ON FUNCTION public.admin_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_dashboard_stats() TO authenticated;

CREATE OR REPLACE FUNCTION public.owner_listing_view_count()
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT count(*) FROM public.listing_views v JOIN public.listings l ON l.id = v.listing_id
  WHERE l.owner_id = auth.uid() AND public.profile_can_act(auth.uid())
$$;
REVOKE EXECUTE ON FUNCTION public.owner_listing_view_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.owner_listing_view_count() TO authenticated;
