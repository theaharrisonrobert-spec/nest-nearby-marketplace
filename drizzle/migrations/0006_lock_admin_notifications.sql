DROP POLICY IF EXISTS "Signed-in users create notifications" ON public.admin_notifications;
CREATE POLICY "Admins create notifications" ON public.admin_notifications FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));
REVOKE INSERT, UPDATE, DELETE ON public.admin_notifications FROM anon;
REVOKE UPDATE, DELETE ON public.admin_notifications FROM authenticated;
GRANT ALL ON public.admin_notifications TO service_role;

CREATE OR REPLACE FUNCTION public.notify_listing_submitted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 INSERT INTO public.admin_notifications (user_id, kind, message) VALUES (NEW.owner_id, 'listing', 'New listing awaiting review: ' || left(NEW.title, 200));
 RETURN NEW;
END $$;
CREATE TRIGGER z_notify_listing_submitted AFTER INSERT ON public.listings FOR EACH ROW WHEN (NEW.status = 'pending') EXECUTE FUNCTION public.notify_listing_submitted();

CREATE OR REPLACE FUNCTION public.notify_report_submitted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 INSERT INTO public.admin_notifications (user_id, kind, message)
 SELECT NEW.reporter_id, 'report', 'Listing reported: ' || left(l.title, 200) FROM public.listings l WHERE l.id = NEW.listing_id;
 RETURN NEW;
END $$;
CREATE TRIGGER z_notify_report_submitted AFTER INSERT ON public.reports FOR EACH ROW EXECUTE FUNCTION public.notify_report_submitted();

CREATE OR REPLACE FUNCTION public.notify_verification_submitted() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
 INSERT INTO public.admin_notifications (user_id, kind, message)
 VALUES (NEW.id, 'verification', 'Verification submitted: ' || coalesce(left(NEW.full_name, 100), 'A user') || ' (' || coalesce(left(NEW.id_type, 40), 'ID') || ')');
 RETURN NEW;
END $$;
CREATE TRIGGER z_notify_verification_submitted AFTER UPDATE ON public.profiles FOR EACH ROW
 WHEN (NEW.verification_status = 'pending' AND (OLD.verification_status IS DISTINCT FROM 'pending' OR OLD.id_document_path IS DISTINCT FROM NEW.id_document_path))
 EXECUTE FUNCTION public.notify_verification_submitted();

CREATE OR REPLACE FUNCTION public.record_sign_in(_method text DEFAULT 'email') RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _email text;
BEGIN
 IF _uid IS NULL THEN RETURN; END IF;
 IF EXISTS (SELECT 1 FROM public.admin_notifications WHERE user_id = _uid AND kind = 'signin' AND created_at > now() - interval '5 minutes') THEN RETURN; END IF;
 SELECT email INTO _email FROM auth.users WHERE id = _uid;
 INSERT INTO public.admin_notifications (user_id, kind, message)
 VALUES (_uid, 'signin', 'Sign in' || CASE WHEN _method = 'google' THEN ' (Google)' ELSE '' END || ': ' || coalesce(_email, 'unknown'));
END $$;
REVOKE EXECUTE ON FUNCTION public.record_sign_in(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.record_sign_in(text) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_listing_submitted(), public.notify_report_submitted(), public.notify_verification_submitted() FROM PUBLIC, anon, authenticated;