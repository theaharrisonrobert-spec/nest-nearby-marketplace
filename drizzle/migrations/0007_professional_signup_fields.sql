ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role_selected boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS professional_type text,
  ADD COLUMN IF NOT EXISTS property_location text,
  ADD COLUMN IF NOT EXISTS property_count text;

ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_professional_type_check
    CHECK (professional_type IS NULL OR professional_type IN ('property_owner', 'agent_realtor', 'property_manager', 'caretaker')),
  ADD CONSTRAINT profiles_property_location_check
    CHECK (property_location IS NULL OR property_location IN ('Lekki', 'Ikeja', 'Yaba', 'Surulere', 'Abuja', 'Port Harcourt', 'Other')),
  ADD CONSTRAINT profiles_property_count_check
    CHECK (property_count IS NULL OR property_count IN ('1', '2-5', '5+'));

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  signup_role text := COALESCE(NEW.raw_user_meta_data->>'account_type', NEW.raw_user_meta_data->>'role');
BEGIN
  INSERT INTO public.profiles (
    id, full_name, phone, account_type, role_selected,
    professional_type, property_location, property_count
  )
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'phone',
    CASE WHEN signup_role IN ('landlord', 'agent') THEN 'landlord' ELSE 'tenant' END,
    signup_role IN ('landlord', 'agent', 'tenant'),
    NEW.raw_user_meta_data->>'professional_type',
    NEW.raw_user_meta_data->>'property_location',
    NEW.raw_user_meta_data->>'property_count'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;