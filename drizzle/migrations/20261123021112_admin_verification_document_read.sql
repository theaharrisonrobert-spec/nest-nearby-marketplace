DROP POLICY IF EXISTS "Admins read ID docs" ON storage.objects;
DROP POLICY IF EXISTS "Admins read verification docs" ON storage.objects;

CREATE POLICY "Admins read identity verification docs"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id IN ('id-documents', 'verification-documents')
    AND public.has_role((SELECT auth.uid()), 'admin')
  );
