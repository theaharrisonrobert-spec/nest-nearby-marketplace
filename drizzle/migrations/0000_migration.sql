CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile read" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, phone)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'), NEW.raw_user_meta_data->>'phone')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE TABLE public.listings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid,
  title text NOT NULL,
  description text,
  category text NOT NULL,
  purpose text NOT NULL DEFAULT 'rent',
  price numeric NOT NULL,
  price_period text NOT NULL DEFAULT 'year',
  negotiable boolean NOT NULL DEFAULT false,
  state text NOT NULL,
  city text NOT NULL,
  address text,
  bedrooms int,
  bathrooms int,
  size_sqft int,
  image_url text,
  contact_name text,
  contact_phone text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.listings TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.listings TO authenticated;
GRANT ALL ON public.listings TO service_role;
ALTER TABLE public.listings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "listings public read" ON public.listings FOR SELECT USING (true);
CREATE POLICY "owner insert" ON public.listings FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "owner update" ON public.listings FOR UPDATE TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "owner delete" ON public.listings FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE POLICY "listing images read" ON storage.objects FOR SELECT USING (bucket_id = 'listing-images');
CREATE POLICY "listing images owner upload" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'listing-images' AND (storage.foldername(name))[1] = auth.uid()::text);

INSERT INTO public.listings (title, description, category, purpose, price, price_period, negotiable, state, city, address, bedrooms, bathrooms, size_sqft, contact_name, contact_phone) VALUES
('3 Bedroom Apartment','Serviced flat with 24/7 power, security and parking.','Apartments','rent',2000000,'year',true,'Lagos','Lekki','Admiralty Way',3,3,1500,'Owner','08030000001'),
('Shop Space in Plaza','Ground floor shop in busy plaza.','Shops','sale',35000000,'once',false,'Lagos','Ikeja','Allen Avenue',null,1,600,'Owner','08030000002'),
('Open-plan Office','Furnished office with sea view.','Office Spaces','rent',1500000,'year',true,'Lagos','Victoria Island','Adeola Odeku',null,1,1000,'Owner','08030000003'),
('2 Bedroom Flat','Newly built flat in quiet estate.','Apartments','rent',1200000,'year',true,'Lagos','Yaba','Sabo',2,2,1100,'Owner','08030000004'),
('Event Hall (500 guests)','Air-conditioned hall with parking for weddings and parties.','Event Halls','rent',800000,'day',true,'Abuja','Wuse 2','Aminu Kano Crescent',null,4,5000,'Owner','08030000005'),
('Plot of Land (600sqm)','Dry land with C of O.','Land','sale',15000000,'once',true,'Ogun','Mowe','Lagos-Ibadan Expressway',null,null,6458,'Owner','08030000006'),
('4 Bedroom Duplex','Detached duplex with BQ.','Houses','sale',120000000,'once',true,'Abuja','Gwarinpa','3rd Avenue',4,5,3500,'Owner','08030000007'),
('Warehouse','Large warehouse with loading bay.','Other Spaces','rent',6000000,'year',false,'Rivers','Port Harcourt','Trans-Amadi',null,2,8000,'Owner','08030000008'),
('Self-contain Room','Clean self-contain near campus.','Apartments','rent',350000,'year',false,'Oyo','Ibadan','Bodija',1,1,300,'Owner','08030000009'),
('Shop in Market Complex','Lock-up shop in new market.','Shops','rent',450000,'year',true,'Kano','Kano','Sabon Gari',null,null,200,'Owner','08030000010');