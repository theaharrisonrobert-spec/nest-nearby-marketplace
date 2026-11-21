CREATE TABLE public.tenant_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  paystack_reference text NOT NULL UNIQUE,
  paystack_authorization_code text,
  paystack_subscription_code text,
  paystack_subscription_token text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','cancelled','failed')),
  plan text NOT NULL DEFAULT 'tenant_premium' CHECK (plan = 'tenant_premium'),
  amount integer NOT NULL DEFAULT 200000 CHECK (amount = 200000),
  current_period_end timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX tenant_subscriptions_user_status_idx
  ON public.tenant_subscriptions (user_id, status, created_at DESC);
ALTER TABLE public.tenant_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tenant_subscriptions FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, user_id, status, plan, amount, current_period_end, cancel_at_period_end, created_at)
  ON public.tenant_subscriptions TO authenticated;
GRANT ALL ON public.tenant_subscriptions TO service_role;
CREATE POLICY "users read their own tenant subscriptions"
  ON public.tenant_subscriptions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

INSERT INTO public.tenant_subscriptions (
  user_id, email, paystack_reference, paystack_subscription_code, paystack_subscription_token,
  status, plan, amount, current_period_end, cancel_at_period_end, created_at
)
SELECT user_id, billing_email, provider_reference, provider_subscription_code, provider_subscription_token,
  'active', 'tenant_premium', amount_ngn * 100, ends_at, cancel_at_period_end, created_at
FROM public.subscriptions
WHERE plan = 'tenant_premium' AND status = 'active' AND amount_ngn = 2000
  AND ends_at IS NOT NULL AND ends_at > now()
ON CONFLICT (paystack_reference) DO NOTHING;

CREATE OR REPLACE FUNCTION public.email_tenant_premium_payment() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE profile_name text;
BEGIN
  IF NEW.status = 'active' AND (OLD.status IS DISTINCT FROM 'active' OR NEW.paystack_reference IS DISTINCT FROM OLD.paystack_reference) THEN
    SELECT full_name INTO profile_name FROM public.profiles WHERE id = NEW.user_id;
    PERFORM public.queue_rentready_email('premium_payment', jsonb_build_object(
      'who_paid', profile_name, 'plan', 'tenant_premium', 'amount', NEW.amount / 100,
      'payment_reference', NEW.paystack_reference
    ));
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER queue_tenant_premium_payment_email
  AFTER UPDATE OF status, paystack_reference ON public.tenant_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.email_tenant_premium_payment();
REVOKE EXECUTE ON FUNCTION public.email_tenant_premium_payment() FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.current_user_has_tenant_premium()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.tenant_subscriptions
    WHERE user_id = auth.uid() AND plan = 'tenant_premium' AND status = 'active'
      AND current_period_end > now()
  )
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_has_tenant_premium() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_has_tenant_premium() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.user_has_active_plan(_user_id uuid, _plan text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _plan = 'tenant_premium' THEN EXISTS (
      SELECT 1 FROM public.tenant_subscriptions s WHERE s.user_id = _user_id
        AND s.plan = 'tenant_premium' AND s.status = 'active' AND s.current_period_end > now()
    )
    ELSE EXISTS (
      SELECT 1 FROM public.subscriptions s WHERE s.user_id = _user_id AND s.plan = _plan
        AND s.status = 'active' AND (s.ends_at IS NULL OR s.ends_at > now())
    )
  END
$$;
