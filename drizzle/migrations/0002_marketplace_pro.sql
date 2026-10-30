ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS account_type text NOT NULL DEFAULT 'tenant';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS agency_verified boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone, account_type, agency_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'phone',
    CASE WHEN NEW.raw_user_meta_data->>'account_type' IN ('landlord','agent','tenant') THEN NEW.raw_user_meta_data->>'account_type' ELSE 'tenant' END,
    NEW.raw_user_meta_data->>'agency_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;

-- users may not self-approve: block changes to protected profile fields by non-admins
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    NEW.agency_verified := OLD.agency_verified;
    NEW.verified_at := OLD.verified_at;
    IF NEW.verification_status NOT IN ('pending') OR OLD.verification_status = 'approved' THEN
      NEW.verification_status := OLD.verification_status;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_profile_fields ON public.profiles;
CREATE TRIGGER protect_profile_fields BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS is_sample boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS sponsored boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS details_reviewed boolean NOT NULL DEFAULT false;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS landmarks text;
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS amenities text[] NOT NULL DEFAULT '{}';
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS show_address boolean NOT NULL DEFAULT false;
UPDATE public.listings SET status = 'approved', is_sample = true WHERE owner_id IS NULL;

CREATE OR REPLACE FUNCTION public.protect_listing_fields()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    IF TG_OP = 'INSERT' THEN
      NEW.status := 'pending'; NEW.sponsored := false; NEW.details_reviewed := false; NEW.is_sample := false;
    ELSE
      NEW.sponsored := OLD.sponsored; NEW.details_reviewed := OLD.details_reviewed; NEW.is_sample := OLD.is_sample;
      NEW.status := CASE WHEN NEW.status = 'unavailable' THEN 'unavailable' ELSE 'pending' END;
    END IF;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS protect_listing_fields ON public.listings;
CREATE TRIGGER protect_listing_fields BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.protect_listing_fields();

DROP POLICY IF EXISTS "listings public read" ON public.listings;
CREATE POLICY "listings public read" ON public.listings FOR SELECT USING (status = 'approved');
CREATE POLICY "owner read own" ON public.listings FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "admin read listings" ON public.listings FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin update listings" ON public.listings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admin delete listings" ON public.listings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- hide phone & exact address from public reads (column privileges)
REVOKE SELECT ON public.listings FROM anon, authenticated;
GRANT SELECT (id, owner_id, title, description, category, purpose, price, price_period, negotiable, state, city, bedrooms, bathrooms, size_sqft, image_url, contact_name, created_at, status, is_sample, sponsored, details_reviewed, landmarks, amenities, show_address) ON public.listings TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.listing_address(_id uuid)
 RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT address FROM public.listings WHERE id = _id AND (show_address OR owner_id = auth.uid() OR public.has_role(auth.uid(),'admin')) $$;

CREATE TABLE public.messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL,
  recipient_id uuid NOT NULL,
  body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.messages TO authenticated;
GRANT ALL ON public.messages TO service_role;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "participants read" ON public.messages FOR SELECT TO authenticated USING (auth.uid() IN (sender_id, recipient_id));
CREATE POLICY "send as self" ON public.messages FOR INSERT TO authenticated WITH CHECK (auth.uid() = sender_id AND sender_id <> recipient_id);
CREATE POLICY "recipient marks read" ON public.messages FOR UPDATE TO authenticated USING (auth.uid() = recipient_id);

CREATE TABLE public.viewings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  requester_id uuid NOT NULL,
  requested_at timestamptz NOT NULL,
  proposed_at timestamptz,
  note text CHECK (char_length(note) <= 500),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','declined','rescheduled','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.viewings TO authenticated;
GRANT ALL ON public.viewings TO service_role;
ALTER TABLE public.viewings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "viewing parties read" ON public.viewings FOR SELECT TO authenticated USING (auth.uid() IN (owner_id, requester_id));
CREATE POLICY "request viewing" ON public.viewings FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND status = 'pending'
  AND owner_id = (SELECT l.owner_id FROM public.listings l WHERE l.id = listing_id));
CREATE POLICY "viewing parties update" ON public.viewings FOR UPDATE TO authenticated USING (auth.uid() IN (owner_id, requester_id));

CREATE TABLE public.reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.listings(id) ON DELETE CASCADE,
  reporter_id uuid NOT NULL,
  reason text NOT NULL CHECK (reason IN ('fraud','wrong_price','duplicate','unavailable','other')),
  details text CHECK (char_length(details) <= 1000),
  resolved boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.reports TO authenticated;
GRANT ALL ON public.reports TO service_role;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "report as self" ON public.reports FOR INSERT TO authenticated WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "admins read reports" ON public.reports FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "admins resolve reports" ON public.reports FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- public verification badges for listing owners
CREATE OR REPLACE FUNCTION public.owner_badges(_owner uuid)
 RETURNS TABLE(account_type text, identity_verified boolean, agency_verified boolean, agency_name text)
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT account_type, verification_status = 'approved', agency_verified, agency_name FROM public.profiles WHERE id = _owner $$;