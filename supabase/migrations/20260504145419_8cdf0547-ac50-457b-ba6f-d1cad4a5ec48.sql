-- Allow anon to execute has_role (used in RLS) and simplify public SELECT for banners
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;

-- Simplify public read policy: anyone can view active banners, no auth needed
DROP POLICY IF EXISTS "Anyone can view active banners" ON public.banners;
CREATE POLICY "Public can view active banners"
ON public.banners
FOR SELECT
TO anon, authenticated
USING (active = true);

-- Admins can also view inactive banners (separate policy, additive)
CREATE POLICY "Admins view all banners"
ON public.banners
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));