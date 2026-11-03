CREATE OR REPLACE FUNCTION public.protect_listing_fields() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 IF NOT public.has_role(auth.uid(), 'admin') THEN
  IF TG_OP = 'INSERT' THEN
   NEW.status := 'pending'; NEW.sponsored := false; NEW.details_reviewed := false; NEW.is_sample := false;
  ELSE
   NEW.sponsored := OLD.sponsored; NEW.details_reviewed := OLD.details_reviewed; NEW.is_sample := OLD.is_sample;
   IF (to_jsonb(NEW) - 'promotion_requested') = (to_jsonb(OLD) - 'promotion_requested') THEN NEW.status := OLD.status;
   ELSE NEW.status := CASE WHEN NEW.status = 'unavailable' THEN 'unavailable' ELSE 'pending' END; END IF;
  END IF;
 END IF;
 RETURN NEW;
END;
$$;