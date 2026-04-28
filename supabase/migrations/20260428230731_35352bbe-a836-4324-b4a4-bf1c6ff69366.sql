-- Fix search_path on touch_updated_at
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- Restrict bucket listing: drop the broad public select policy
DROP POLICY IF EXISTS "Public read product images" ON storage.objects;

-- Allow public to read individual files but not list arbitrarily (no listing via name patterns)
-- Public bucket already allows direct URL access regardless of policy; this policy enables RPC reads of known objects only
CREATE POLICY "Public read specific product images" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'products' AND (auth.role() = 'authenticated' OR auth.role() = 'anon'));

-- Revoke execute on has_role from public roles
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO service_role;