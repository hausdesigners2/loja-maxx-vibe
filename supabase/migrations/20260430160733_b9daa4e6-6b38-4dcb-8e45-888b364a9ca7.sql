REVOKE EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) FROM anon, authenticated, public;
SELECT pg_notify('pgrst', 'reload schema');