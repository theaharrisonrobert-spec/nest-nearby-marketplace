ALTER TABLE public.listings ADD COLUMN promotion_requested boolean NOT NULL DEFAULT false;
GRANT SELECT (promotion_requested), UPDATE (promotion_requested) ON public.listings TO authenticated;
CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 INSERT INTO public.profiles (id, full_name, phone, account_type)
 VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'phone', CASE WHEN NEW.raw_user_meta_data->>'account_type' = 'landlord' THEN 'landlord' ELSE 'tenant' END)
 ON CONFLICT (id) DO NOTHING;
 RETURN NEW;
END;
$$;
CREATE OR REPLACE FUNCTION public.validate_marketplace_account() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
 IF TG_OP = 'INSERT' OR NEW.account_type IS DISTINCT FROM OLD.account_type THEN
  IF NEW.account_type NOT IN ('landlord', 'tenant') THEN RAISE EXCEPTION 'Choose a landlord or buyer / tenant account'; END IF;
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER validate_marketplace_account BEFORE INSERT OR UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.validate_marketplace_account();
ALTER POLICY "owner insert" ON public.listings WITH CHECK (auth.uid() = owner_id AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.verification_status = 'approved' AND p.account_type = 'landlord'));
CREATE OR REPLACE FUNCTION public.validate_promotion_request() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF TG_OP = 'INSERT' THEN NEW.promotion_requested := false;
 ELSIF NEW.promotion_requested IS DISTINCT FROM OLD.promotion_requested AND NOT public.has_role(auth.uid(), 'admin') THEN
  IF auth.uid() IS DISTINCT FROM NEW.owner_id OR NOT NEW.promotion_requested OR OLD.status <> 'approved' OR OLD.sponsored OR NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND account_type = 'landlord' AND verification_status = 'approved') THEN
   RAISE EXCEPTION 'Only verified landlords may request promotion for their live listings';
  END IF;
  INSERT INTO public.admin_notifications (user_id, kind, message) VALUES (auth.uid(), 'promotion', 'Promotion requested: ' || NEW.title);
 END IF;
 RETURN NEW;
END;
$$;
CREATE TRIGGER a_validate_promotion_request BEFORE INSERT OR UPDATE ON public.listings FOR EACH ROW EXECUTE FUNCTION public.validate_promotion_request();