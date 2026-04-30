GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO anon, authenticated;
SELECT pg_notify('pgrst', 'reload schema');