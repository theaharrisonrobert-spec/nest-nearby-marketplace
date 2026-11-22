ALTER TABLE public.email_outbox
  DROP CONSTRAINT IF EXISTS email_outbox_recipient_check,
  DROP CONSTRAINT IF EXISTS email_outbox_event_check;

ALTER TABLE public.email_outbox
  ADD CONSTRAINT email_outbox_event_check
    CHECK (event IN (
      'signup', 'listing', 'viewing_request', 'viewing_completed', 'premium_payment',
      'admin_notification', 'welcome_landlord', 'welcome_tenant'
    )),
  ADD CONSTRAINT email_outbox_recipient_check
    CHECK (
      recipient = 'rentreadyng@gmail.com'
      OR (
        event IN ('welcome_landlord', 'welcome_tenant')
        AND position('@' IN recipient) > 1
        AND position('.' IN split_part(recipient, '@', 2)) > 1
        AND recipient !~ '[[:space:]]'
      )
    );

CREATE UNIQUE INDEX IF NOT EXISTS email_outbox_one_welcome_per_user
  ON public.email_outbox ((payload->>'user_id'))
  WHERE event IN ('welcome_landlord', 'welcome_tenant');

CREATE OR REPLACE FUNCTION public.queue_user_welcome_email(_user_id uuid, _email text, _metadata jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_role text := lower(coalesce(nullif(_metadata->>'account_type', ''), nullif(_metadata->>'role', '')));
  signup_name text := btrim(coalesce(nullif(_metadata->>'full_name', ''), nullif(_metadata->>'name', ''), 'there'));
  welcome_event text;
BEGIN
  IF _metadata->>'role_selected' IS DISTINCT FROM 'true' OR _email IS NULL THEN
    RETURN;
  END IF;

  IF signup_role IN ('landlord', 'agent') THEN
    welcome_event := 'welcome_landlord';
  ELSIF signup_role = 'tenant' THEN
    welcome_event := 'welcome_tenant';
  ELSE
    RETURN;
  END IF;

  INSERT INTO public.email_outbox (recipient, event, payload)
  VALUES (
    _email,
    welcome_event,
    jsonb_build_object(
      'user_id', _user_id,
      'first_name', split_part(signup_name, ' ', 1)
    )
  )
  ON CONFLICT ((payload->>'user_id'))
    WHERE event IN ('welcome_landlord', 'welcome_tenant')
    DO NOTHING;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.queue_user_welcome_email(uuid, text, jsonb) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_new_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.queue_rentready_email('signup', jsonb_build_object(
    'name', coalesce(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', 'Unnamed user'),
    'role', coalesce(NEW.raw_user_meta_data->>'account_type', 'tenant'),
    'email', NEW.email,
    'phone', NEW.raw_user_meta_data->>'phone',
    'date', now()
  ));
  PERFORM public.queue_user_welcome_email(NEW.id, NEW.email, NEW.raw_user_meta_data);
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.email_new_signup() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.email_welcome_after_role_selection()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.raw_user_meta_data->>'role_selected' IS DISTINCT FROM 'true'
     AND NEW.raw_user_meta_data->>'role_selected' = 'true' THEN
    PERFORM public.queue_user_welcome_email(NEW.id, NEW.email, NEW.raw_user_meta_data);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.email_welcome_after_role_selection() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS queue_welcome_after_role_selection ON auth.users;
CREATE TRIGGER queue_welcome_after_role_selection
  AFTER UPDATE OF raw_user_meta_data ON auth.users
  FOR EACH ROW
  WHEN (OLD.raw_user_meta_data->>'role_selected' IS DISTINCT FROM 'true'
    AND NEW.raw_user_meta_data->>'role_selected' = 'true')
  EXECUTE FUNCTION public.email_welcome_after_role_selection();
