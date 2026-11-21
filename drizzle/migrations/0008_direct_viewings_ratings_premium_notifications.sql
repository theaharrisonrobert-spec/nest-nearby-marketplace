-- Direct-to-owner viewing lifecycle, ratings, membership records and private email queue.
ALTER TABLE public.viewings
  ADD COLUMN viewing_code text,
  ADD COLUMN started_at timestamptz,
  ADD COLUMN landlord_completed_at timestamptz,
  ADD COLUMN tenant_completed_at timestamptz;

UPDATE public.viewings SET status = CASE status
  WHEN 'pending' THEN 'requested'
  WHEN 'rescheduled' THEN 'accepted'
  ELSE status
END;
ALTER TABLE public.viewings ALTER COLUMN status SET DEFAULT 'requested';
ALTER TABLE public.viewings DROP CONSTRAINT IF EXISTS viewings_status_check;
ALTER TABLE public.viewings ADD CONSTRAINT viewings_status_check
  CHECK (status IN ('requested','accepted','declined','cancelled','met','completed','rated'));

CREATE OR REPLACE FUNCTION public.assign_viewing_code() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE candidate text;
BEGIN
  IF NEW.viewing_code IS NULL THEN
    LOOP
      candidate := 'RR-' || lpad((1000 + floor(random() * 9000))::int::text, 4, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.viewings WHERE viewing_code = candidate);
    END LOOP;
    NEW.viewing_code := candidate;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER assign_viewing_code BEFORE INSERT ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.assign_viewing_code();
CREATE UNIQUE INDEX viewings_viewing_code_key ON public.viewings(viewing_code);

DROP POLICY IF EXISTS "viewing parties update" ON public.viewings;
DROP POLICY IF EXISTS "request viewing" ON public.viewings;
CREATE POLICY "request viewing" ON public.viewings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = requester_id AND requester_id <> owner_id AND status = 'requested'
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = public.viewings.owner_id AND l.status = 'approved' AND NOT l.is_sample)
);

CREATE OR REPLACE FUNCTION public.respond_to_viewing(_viewing_id uuid, _accept boolean)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.viewings SET status = CASE WHEN _accept THEN 'accepted' ELSE 'declined' END
  WHERE id = _viewing_id AND owner_id = auth.uid() AND status = 'requested';
  IF NOT FOUND THEN RAISE EXCEPTION 'Viewing request is no longer available'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.start_viewing(_viewing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.viewings SET status = 'met', started_at = now()
  WHERE id = _viewing_id AND owner_id = auth.uid() AND status = 'accepted';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only the landlord can start an accepted viewing'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.complete_viewing(_viewing_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.viewings SET
    landlord_completed_at = CASE WHEN owner_id = auth.uid() THEN COALESCE(landlord_completed_at, now()) ELSE landlord_completed_at END,
    tenant_completed_at = CASE WHEN requester_id = auth.uid() THEN COALESCE(tenant_completed_at, now()) ELSE tenant_completed_at END,
    status = CASE
      WHEN (owner_id = auth.uid() OR landlord_completed_at IS NOT NULL)
       AND (requester_id = auth.uid() OR tenant_completed_at IS NOT NULL) THEN 'completed'
      ELSE 'met'
    END
  WHERE id = _viewing_id AND auth.uid() IN (owner_id, requester_id) AND status = 'met';
  IF NOT FOUND THEN RAISE EXCEPTION 'Only viewing participants can confirm a viewing in progress'; END IF;
END $$;

REVOKE UPDATE ON public.viewings FROM authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_viewing(uuid, boolean), public.start_viewing(uuid), public.complete_viewing(uuid) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.assign_viewing_code() FROM PUBLIC, anon, authenticated;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_review_required boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS verification_fee_paid boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone_verified_at timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS featured_until timestamptz;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS early_access_until timestamptz;
GRANT SELECT (featured_until, early_access_until) ON public.listings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    NEW.agency_verified := OLD.agency_verified;
    NEW.verified_at := OLD.verified_at;
    NEW.account_review_required := OLD.account_review_required;
    NEW.verification_fee_paid := OLD.verification_fee_paid;
    NEW.phone_verified_at := OLD.phone_verified_at;
    IF OLD.role_selected OR NOT NEW.role_selected OR NEW.account_type NOT IN ('tenant','landlord') THEN
      NEW.role_selected := OLD.role_selected;
      NEW.account_type := OLD.account_type;
    END IF;
    IF OLD.phone_verified_at IS NOT NULL AND NEW.phone IS DISTINCT FROM OLD.phone THEN
      NEW.phone := OLD.phone;
    END IF;
    IF NEW.verification_status NOT IN ('pending') OR OLD.verification_status = 'approved' THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.sync_verified_phone() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE previous_role text;
BEGIN
  IF NEW.phone IS DISTINCT FROM OLD.phone OR NEW.phone_confirmed_at IS DISTINCT FROM OLD.phone_confirmed_at THEN
    previous_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    UPDATE public.profiles SET phone = NEW.phone, phone_verified_at = CASE WHEN NEW.phone IS NOT NULL THEN NEW.phone_confirmed_at ELSE NULL END WHERE id = NEW.id;
    PERFORM set_config('request.jwt.claim.role', coalesce(previous_role, 'authenticated'), true);
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER sync_verified_phone_after_auth_update AFTER UPDATE OF phone, phone_confirmed_at ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.sync_verified_phone();
SELECT set_config('request.jwt.claim.role', 'service_role', true);
UPDATE public.profiles p SET phone = u.phone, phone_verified_at = u.phone_confirmed_at
  FROM auth.users u WHERE u.id = p.id AND u.phone IS NOT NULL AND u.phone_confirmed_at IS NOT NULL AND p.phone_verified_at IS NULL;
SELECT set_config('request.jwt.claim.role', 'authenticated', true);

DROP POLICY IF EXISTS "request viewing" ON public.viewings;
CREATE POLICY "request viewing" ON public.viewings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = requester_id AND requester_id <> owner_id AND status = 'requested'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified_at IS NOT NULL)
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = public.viewings.owner_id AND l.status = 'approved' AND NOT l.is_sample)
);

CREATE OR REPLACE FUNCTION public.is_verified_landlord(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = _owner AND account_type = 'landlord' AND verification_status = 'approved' AND NOT account_review_required AND (professional_type IS NULL OR professional_type = 'property_owner'))
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_landlord(uuid) TO anon, authenticated;
DROP POLICY IF EXISTS "request viewing" ON public.viewings;
CREATE POLICY "request viewing" ON public.viewings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = requester_id AND requester_id <> owner_id AND status = 'requested'
  AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.phone_verified_at IS NOT NULL)
  AND public.is_verified_landlord(public.viewings.owner_id)
  AND EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = public.viewings.owner_id AND l.status = 'approved' AND NOT l.is_sample)
);
CREATE OR REPLACE FUNCTION public.first_free_landlord_listing(_owner uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.listings WHERE owner_id = _owner AND status = 'approved' AND NOT is_sample ORDER BY created_at ASC LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.first_free_landlord_listing(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.protect_listing_fields()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') AND current_setting('request.jwt.claim.role', true) IS DISTINCT FROM 'service_role' THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending'; NEW.sponsored := false; NEW.details_reviewed := false; NEW.is_sample := false;
      NEW.featured_until := NULL; NEW.early_access_until := NULL;
    ELSE
      NEW.sponsored := OLD.sponsored; NEW.details_reviewed := OLD.details_reviewed; NEW.is_sample := OLD.is_sample;
      NEW.featured_until := OLD.featured_until; NEW.early_access_until := OLD.early_access_until;
      IF (to_jsonb(NEW) - 'promotion_requested') = (to_jsonb(OLD) - 'promotion_requested') THEN NEW.status := OLD.status;
      ELSE NEW.status := CASE WHEN NEW.status = 'unavailable' THEN 'unavailable' ELSE 'pending' END; END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' AND OLD.status <> 'approved' AND NEW.status = 'approved' THEN
    NEW.early_access_until := now() + interval '24 hours';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.expire_listing_features() RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE previous_role text;
BEGIN
  previous_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  UPDATE public.listings SET featured_until = NULL WHERE featured_until IS NOT NULL AND featured_until <= now();
  PERFORM set_config('request.jwt.claim.role', coalesce(previous_role, 'anon'), true);
END $$;
GRANT EXECUTE ON FUNCTION public.expire_listing_features() TO anon, authenticated;

CREATE TABLE public.viewing_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  viewing_id uuid NOT NULL REFERENCES public.viewings(id) ON DELETE CASCADE,
  rater_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ratee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  overall_stars int NOT NULL CHECK (overall_stars BETWEEN 1 AND 5),
  property_real boolean,
  price_same boolean,
  landlord_polite boolean,
  tenant_showed_up boolean,
  tenant_serious boolean,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (viewing_id, rater_id),
  CHECK (rater_id <> ratee_id)
);
GRANT SELECT, INSERT ON public.viewing_ratings TO authenticated;
GRANT ALL ON public.viewing_ratings TO service_role;
ALTER TABLE public.viewing_ratings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewing parties read ratings" ON public.viewing_ratings FOR SELECT TO authenticated
  USING (auth.uid() IN (rater_id, ratee_id));
CREATE POLICY "rate completed viewing party" ON public.viewing_ratings FOR INSERT TO authenticated WITH CHECK (
  auth.uid() = rater_id AND EXISTS (
    SELECT 1 FROM public.viewings v WHERE v.id = viewing_id AND v.status = 'completed'
      AND ((v.requester_id = rater_id AND v.owner_id = ratee_id AND property_real IS NOT NULL AND price_same IS NOT NULL AND landlord_polite IS NOT NULL AND tenant_showed_up IS NULL AND tenant_serious IS NULL)
        OR (v.owner_id = rater_id AND v.requester_id = ratee_id AND tenant_showed_up IS NOT NULL AND tenant_serious IS NOT NULL AND property_real IS NULL AND price_same IS NULL AND landlord_polite IS NULL))
  )
);

CREATE OR REPLACE FUNCTION public.flag_low_rated_landlord() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE previous_role text;
BEGIN
  IF (SELECT account_type FROM public.profiles WHERE id = NEW.ratee_id) = 'landlord'
    AND NEW.overall_stars < 3
    AND (SELECT count(*) FROM public.viewing_ratings WHERE ratee_id = NEW.ratee_id AND overall_stars < 3) >= 3 THEN
    previous_role := current_setting('request.jwt.claim.role', true);
    PERFORM set_config('request.jwt.claim.role', 'service_role', true);
    UPDATE public.profiles SET account_review_required = true WHERE id = NEW.ratee_id;
    PERFORM set_config('request.jwt.claim.role', coalesce(previous_role, 'authenticated'), true);
    INSERT INTO public.admin_notifications (user_id, kind, message)
    VALUES (NEW.ratee_id, 'landlord_review', 'A landlord received three ratings below 3 stars and requires review.');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER flag_low_rated_landlord AFTER INSERT ON public.viewing_ratings
  FOR EACH ROW EXECUTE FUNCTION public.flag_low_rated_landlord();
CREATE OR REPLACE FUNCTION public.mark_viewing_rated() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (SELECT count(*) FROM public.viewing_ratings WHERE viewing_id = NEW.viewing_id) >= 2 THEN
    UPDATE public.viewings SET status = 'rated' WHERE id = NEW.viewing_id AND status = 'completed';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER mark_viewing_rated_after_both_reviews AFTER INSERT ON public.viewing_ratings
  FOR EACH ROW EXECUTE FUNCTION public.mark_viewing_rated();
REVOKE EXECUTE ON FUNCTION public.flag_low_rated_landlord() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.mark_viewing_rated() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL CHECK (plan IN ('landlord_premium','tenant_premium','featured_listing','nin_verification')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','failed','cancelled')),
  amount_ngn int NOT NULL CHECK (amount_ngn > 0),
  provider text NOT NULL DEFAULT 'paystack' CHECK (provider IN ('paystack','flutterwave')),
  provider_reference text NOT NULL UNIQUE,
  billing_email text NOT NULL,
  last_charge_reference text,
  provider_subscription_code text,
  provider_subscription_token text,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  listing_id uuid REFERENCES public.listings(id) ON DELETE CASCADE,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE SELECT ON public.subscriptions FROM authenticated;
GRANT SELECT (id, user_id, plan, status, amount_ngn, provider, listing_id, starts_at, ends_at, cancel_at_period_end, created_at) ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users read own subscriptions" ON public.subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE TABLE public.payment_event_refs (
  provider_reference text PRIMARY KEY,
  subscription_id uuid NOT NULL REFERENCES public.subscriptions(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON public.payment_event_refs FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.payment_event_refs TO service_role;
ALTER TABLE public.payment_event_refs ENABLE ROW LEVEL SECURITY;
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

  IF payment.plan IN ('landlord_premium','tenant_premium') THEN
    period_end := CASE WHEN _recurring AND payment.ends_at > now_at THEN payment.ends_at + interval '30 days' ELSE now_at + interval '30 days' END;
  ELSE
    period_end := NULL;
  END IF;
  UPDATE public.subscriptions SET status = 'active', starts_at = coalesce(starts_at, now_at), ends_at = period_end, last_charge_reference = _charge_reference WHERE id = payment.id;

  previous_role := current_setting('request.jwt.claim.role', true);
  PERFORM set_config('request.jwt.claim.role', 'service_role', true);
  IF payment.plan = 'featured_listing' AND payment.listing_id IS NOT NULL THEN
    UPDATE public.listings SET featured_until = now_at + interval '7 days' WHERE id = payment.listing_id AND owner_id = payment.user_id AND status = 'approved';
  ELSIF payment.plan = 'nin_verification' THEN
    UPDATE public.profiles SET verification_fee_paid = true WHERE id = payment.user_id;
  END IF;
  PERFORM set_config('request.jwt.claim.role', coalesce(previous_role, 'service_role'), true);
  RETURN true;
END $$;
REVOKE EXECUTE ON FUNCTION public.apply_paystack_payment(uuid, text, bigint, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.apply_paystack_payment(uuid, text, bigint, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.user_has_active_plan(_user_id uuid, _plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.user_id = _user_id AND s.plan = _plan AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now()))
$$;
REVOKE EXECUTE ON FUNCTION public.user_has_active_plan(uuid, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_tenant_premium()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = auth.uid() AND plan = 'tenant_premium' AND status = 'active' AND (ends_at IS NULL OR ends_at > now()))
$$;
GRANT EXECUTE ON FUNCTION public.current_user_has_tenant_premium() TO anon, authenticated;

CREATE TABLE public.tenant_alert_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  areas text[] NOT NULL DEFAULT '{}',
  min_budget numeric,
  max_budget numeric,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (min_budget IS NULL OR min_budget >= 0),
  CHECK (max_budget IS NULL OR max_budget >= 0),
  CHECK (min_budget IS NULL OR max_budget IS NULL OR min_budget <= max_budget)
);
GRANT SELECT, INSERT, UPDATE ON public.tenant_alert_preferences TO authenticated;
ALTER TABLE public.tenant_alert_preferences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premium tenants manage alert preferences" ON public.tenant_alert_preferences FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.current_user_has_tenant_premium())
  WITH CHECK (user_id = auth.uid() AND public.current_user_has_tenant_premium());

CREATE TABLE public.tenant_alert_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  seen_at timestamptz,
  UNIQUE (user_id, listing_id)
);
GRANT SELECT ON public.tenant_alert_matches TO authenticated;
GRANT UPDATE (seen_at) ON public.tenant_alert_matches TO authenticated;
ALTER TABLE public.tenant_alert_matches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenants read their alert matches" ON public.tenant_alert_matches FOR SELECT TO authenticated USING (user_id = auth.uid() AND public.current_user_has_tenant_premium());
CREATE POLICY "tenants mark their alerts read" ON public.tenant_alert_matches FOR UPDATE TO authenticated USING (user_id = auth.uid() AND public.current_user_has_tenant_premium()) WITH CHECK (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.match_premium_tenant_alerts() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'approved' AND OLD.status IS DISTINCT FROM 'approved' AND NOT NEW.is_sample THEN
    INSERT INTO public.tenant_alert_matches(user_id, listing_id)
    SELECT p.user_id, NEW.id FROM public.tenant_alert_preferences p
    WHERE public.user_has_active_plan(p.user_id, 'tenant_premium')
      AND (cardinality(p.areas) = 0 OR EXISTS (
        SELECT 1 FROM unnest(p.areas) AS area(value) WHERE position(lower(trim(area.value)) in lower(NEW.city || ' ' || NEW.state)) > 0
      ))
      AND (p.min_budget IS NULL OR NEW.price >= p.min_budget)
      AND (p.max_budget IS NULL OR NEW.price <= p.max_budget)
      AND p.user_id <> NEW.owner_id
    ON CONFLICT (user_id, listing_id) DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER match_new_premium_tenant_alerts AFTER UPDATE OF status ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.match_premium_tenant_alerts();
REVOKE EXECUTE ON FUNCTION public.match_premium_tenant_alerts() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_landlord_premium()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.subscriptions WHERE user_id = auth.uid() AND plan = 'landlord_premium' AND status = 'active' AND (ends_at IS NULL OR ends_at > now()))
$$;
GRANT EXECUTE ON FUNCTION public.current_user_has_landlord_premium() TO authenticated;

CREATE OR REPLACE FUNCTION public.is_verified_premium_landlord(_owner uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.is_verified_landlord(_owner) AND EXISTS (
    SELECT 1 FROM public.subscriptions WHERE user_id = _owner AND plan = 'landlord_premium' AND status = 'active' AND (ends_at IS NULL OR ends_at > now())
  )
$$;
GRANT EXECUTE ON FUNCTION public.is_verified_premium_landlord(uuid) TO anon, authenticated;

DROP POLICY IF EXISTS "listings public read" ON public.listings;
CREATE POLICY "listings public read" ON public.listings FOR SELECT USING (
  status = 'approved' AND NOT is_sample AND public.is_verified_landlord(owner_id)
  AND (public.is_verified_premium_landlord(owner_id) OR id = public.first_free_landlord_listing(owner_id))
  AND (early_access_until IS NULL OR early_access_until <= now() OR owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.current_user_has_tenant_premium())
);

CREATE OR REPLACE FUNCTION public.enforce_listing_plan_limits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF public.user_has_active_plan(NEW.owner_id, 'landlord_premium')
      AND (SELECT count(*) FROM public.listings WHERE owner_id = NEW.owner_id AND status <> 'unavailable' AND NOT is_sample) >= 5 THEN
      RAISE EXCEPTION 'Premium landlord accounts can have up to five active properties';
    ELSIF NOT public.user_has_active_plan(NEW.owner_id, 'landlord_premium')
      AND (SELECT count(*) FROM public.listings WHERE owner_id = NEW.owner_id AND status <> 'unavailable' AND NOT is_sample) >= 1 THEN
      RAISE EXCEPTION 'Free landlord accounts can have one active property. Upgrade to Premium to list up to five.';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_listing_plan_limits BEFORE INSERT ON public.listings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_listing_plan_limits();

CREATE OR REPLACE FUNCTION public.enforce_viewing_plan_limits() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE request_total int;
BEGIN
  IF public.user_has_active_plan(NEW.owner_id, 'landlord_premium') THEN RETURN NEW; END IF;
  SELECT count(*) INTO request_total FROM public.viewings
    WHERE owner_id = NEW.owner_id AND created_at >= date_trunc('month', now());
  IF request_total >= 5 THEN RAISE EXCEPTION 'This landlord has reached the free monthly viewing request limit'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_viewing_plan_limits BEFORE INSERT ON public.viewings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_viewing_plan_limits();

CREATE TABLE public.listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.listing_views TO service_role;
ALTER TABLE public.listing_views ENABLE ROW LEVEL SECURITY;
CREATE POLICY "premium landlords read listing viewers" ON public.listing_views FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.listings l WHERE l.id = listing_id AND l.owner_id = auth.uid())
  AND public.current_user_has_landlord_premium()
);
CREATE OR REPLACE FUNCTION public.record_listing_view(_listing_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND EXISTS (SELECT 1 FROM public.listings WHERE id = _listing_id AND status = 'approved' AND NOT is_sample AND owner_id <> auth.uid()) THEN
    INSERT INTO public.listing_views(listing_id, viewer_id) VALUES (_listing_id, auth.uid());
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.record_listing_view(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.premium_listing_viewers()
RETURNS TABLE (listing_id uuid, viewer_id uuid, viewer_name text, viewed_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT lv.listing_id, lv.viewer_id, p.full_name, lv.created_at
  FROM public.listing_views lv JOIN public.listings l ON l.id = lv.listing_id
  LEFT JOIN public.profiles p ON p.id = lv.viewer_id
  WHERE l.owner_id = auth.uid() AND public.user_has_active_plan(auth.uid(), 'landlord_premium')
$$;
GRANT EXECUTE ON FUNCTION public.premium_listing_viewers() TO authenticated;

CREATE TABLE public.email_outbox (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  recipient text NOT NULL DEFAULT 'rentreadyng@gmail.com' CHECK (recipient = 'rentreadyng@gmail.com'),
  event text NOT NULL CHECK (event IN ('signup','listing','viewing_request','viewing_completed','premium_payment')),
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  claimed_at timestamptz,
  attempts int NOT NULL DEFAULT 0
);
REVOKE ALL ON public.email_outbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.email_outbox TO service_role;
ALTER TABLE public.email_outbox ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.claim_email_outbox(_id bigint)
RETURNS TABLE (id bigint, recipient text, event text, payload jsonb, attempts int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY UPDATE public.email_outbox o
    SET claimed_at = now(), attempts = o.attempts + 1
    WHERE o.id = _id AND o.sent_at IS NULL AND (o.claimed_at IS NULL OR o.claimed_at < now() - interval '10 minutes')
    RETURNING o.id, o.recipient, o.event, o.payload, o.attempts;
END $$;
REVOKE EXECUTE ON FUNCTION public.claim_email_outbox(bigint) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_email_outbox(bigint) TO service_role;

CREATE OR REPLACE FUNCTION public.queue_rentready_email(_event text, _payload jsonb) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.email_outbox(event, payload) VALUES (_event, _payload)
$$;
REVOKE EXECUTE ON FUNCTION public.queue_rentready_email(text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_new_signup() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public.queue_rentready_email('signup', jsonb_build_object('name',coalesce(NEW.raw_user_meta_data->>'full_name',NEW.raw_user_meta_data->>'name','Unnamed user'),'role',coalesce(NEW.raw_user_meta_data->>'account_type','tenant'),'email',NEW.email,'phone',NEW.raw_user_meta_data->>'phone','date',now()));
  RETURN NEW;
END $$;
CREATE TRIGGER queue_signup_email AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.email_new_signup();
CREATE OR REPLACE FUNCTION public.email_new_listing() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE profile_name text; profile_phone text;
BEGIN
  SELECT full_name, phone INTO profile_name, profile_phone FROM public.profiles WHERE id = NEW.owner_id;
  PERFORM public.queue_rentready_email('listing', jsonb_build_object('title',NEW.title,'price',NEW.price,'location',NEW.city || ', ' || NEW.state,'landlord_name',profile_name,'landlord_phone',profile_phone));
  RETURN NEW;
END $$;
CREATE TRIGGER queue_listing_email AFTER INSERT ON public.listings FOR EACH ROW EXECUTE FUNCTION public.email_new_listing();
CREATE OR REPLACE FUNCTION public.email_viewing_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tenant_name text; tenant_phone text; listing_title text;
BEGIN
  SELECT full_name, phone INTO tenant_name, tenant_phone FROM public.profiles WHERE id = NEW.requester_id;
  SELECT title INTO listing_title FROM public.listings WHERE id = NEW.listing_id;
  PERFORM public.queue_rentready_email('viewing_request', jsonb_build_object('tenant_name',tenant_name,'tenant_phone',tenant_phone,'property_title',listing_title,'date_time',NEW.requested_at,'viewing_code',NEW.viewing_code));
  RETURN NEW;
END $$;
CREATE TRIGGER queue_viewing_email AFTER INSERT ON public.viewings FOR EACH ROW EXECUTE FUNCTION public.email_viewing_request();
DROP TRIGGER IF EXISTS queue_viewing_completed_email ON public.viewings;
CREATE UNIQUE INDEX email_outbox_viewing_completed_once ON public.email_outbox ((payload->>'viewing_id')) WHERE event = 'viewing_completed';
CREATE OR REPLACE FUNCTION public.email_completed_viewing_rating() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE tenant_name text; landlord_name text; listing_title text;
BEGIN
  IF EXISTS (SELECT 1 FROM public.viewings WHERE id = NEW.viewing_id AND status = 'completed') THEN
    SELECT l.title, tenant.full_name, landlord.full_name INTO listing_title, tenant_name, landlord_name
      FROM public.viewings v JOIN public.listings l ON l.id = v.listing_id
      LEFT JOIN public.profiles tenant ON tenant.id = v.requester_id
      LEFT JOIN public.profiles landlord ON landlord.id = v.owner_id WHERE v.id = NEW.viewing_id;
    INSERT INTO public.email_outbox(event, payload) VALUES ('viewing_completed', jsonb_build_object('viewing_id',NEW.viewing_id,'property',listing_title,'tenant_name',tenant_name,'landlord_name',landlord_name,'rating',NEW.overall_stars))
      ON CONFLICT ((payload->>'viewing_id')) WHERE event = 'viewing_completed' DO NOTHING;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_completed_rating_email AFTER INSERT ON public.viewing_ratings FOR EACH ROW EXECUTE FUNCTION public.email_completed_viewing_rating();
CREATE OR REPLACE FUNCTION public.email_premium_payment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE profile_name text;
BEGIN
  IF NEW.last_charge_reference IS DISTINCT FROM OLD.last_charge_reference AND NEW.last_charge_reference IS NOT NULL THEN
    SELECT full_name INTO profile_name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.queue_rentready_email('premium_payment', jsonb_build_object('who_paid',profile_name,'plan',NEW.plan,'amount',NEW.amount_ngn,'payment_reference',NEW.last_charge_reference));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_payment_email AFTER UPDATE OF last_charge_reference ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.email_premium_payment();
REVOKE EXECUTE ON FUNCTION public.email_new_signup(), public.email_new_listing(), public.email_viewing_request(), public.email_completed_viewing_rating(), public.email_premium_payment() FROM PUBLIC, anon, authenticated;

CREATE TABLE public.visitor_counter (
  day date PRIMARY KEY DEFAULT current_date,
  visits bigint NOT NULL DEFAULT 0
);
ALTER TABLE public.visitor_counter ENABLE ROW LEVEL SECURITY;
CREATE POLICY "admins read visitor counter" ON public.visitor_counter FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE OR REPLACE FUNCTION public.record_site_visit() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.visitor_counter(day, visits) VALUES (current_date, 1)
  ON CONFLICT(day) DO UPDATE SET visits = visitor_counter.visits + 1;
END $$;
REVOKE EXECUTE ON FUNCTION public.record_site_visit() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_site_visit() TO anon, authenticated;
CREATE OR REPLACE FUNCTION public.admin_site_visit_count() RETURNS bigint
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce(sum(visits), 0) FROM public.visitor_counter WHERE public.has_role(auth.uid(), 'admin')
$$;
REVOKE EXECUTE ON FUNCTION public.admin_site_visit_count() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_site_visit_count() TO authenticated;

