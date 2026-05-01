grant usage on type public.app_role to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to authenticated;