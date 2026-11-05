REVOKE SELECT ON public.listings FROM anon, authenticated, PUBLIC;
GRANT SELECT (id, owner_id, title, description, category, purpose, price, price_period, negotiable, state, city, bedrooms, bathrooms, size_sqft, image_url, contact_name, created_at, status, is_sample, sponsored, details_reviewed, landmarks, amenities, show_address, promotion_requested) ON public.listings TO anon, authenticated;
GRANT ALL ON public.listings TO service_role;

CREATE OR REPLACE FUNCTION public.listing_private_details(_id uuid)
RETURNS TABLE(address text, contact_phone text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT l.address, l.contact_phone FROM public.listings l
 WHERE l.id = _id AND auth.uid() IS NOT NULL AND (l.owner_id = auth.uid() OR public.has_role(auth.uid(), 'admin')) $$;
REVOKE EXECUTE ON FUNCTION public.listing_private_details(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listing_private_details(uuid) TO authenticated;