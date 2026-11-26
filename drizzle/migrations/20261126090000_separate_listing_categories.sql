-- Split the former mixed housing category into Apartment listings with a subtype.
ALTER TABLE public.listings ADD COLUMN IF NOT EXISTS property_subtype text;

UPDATE public.listings
SET category = 'Apartment',
    property_subtype = CASE
      WHEN title ILIKE '%duplex%' THEN 'Duplex'
      WHEN title ILIKE '%mini flat%' OR title ILIKE '%mini-flat%' THEN 'Mini Flat'
      WHEN title ILIKE '%self contain%' OR title ILIKE '%self-contain%' OR title ILIKE '%selfcon%' THEN 'Self-Contain'
      WHEN title ILIKE '%room%parlour%' OR title ILIKE '%room and parlour%' THEN 'Room & Parlour'
      WHEN title ILIKE '%studio%' THEN 'Studio'
      WHEN title ILIKE '%bungalow%' THEN 'Bungalow'
      WHEN title ILIKE '%penthouse%' THEN 'Penthouse'
      WHEN title ILIKE '%villa%' THEN 'Villa'
      WHEN title ILIKE '%townhouse%' OR title ILIKE '%town house%' THEN 'Townhouse'
      ELSE 'Flat'
    END
WHERE category IN ('Apartments', 'Houses');

GRANT SELECT (property_subtype) ON public.listings TO anon, authenticated;
