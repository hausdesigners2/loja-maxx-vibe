-- Grant INSERT privilege on security_logs to anon and authenticated roles so they can log events
GRANT INSERT ON TABLE public.security_logs TO anon, authenticated;

-- Ensure service_role has full access for administrative/backend purposes
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_logs TO service_role;

-- Ensure Row Level Security is enabled on the table
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Create a secure policy that allows anyone (both anonymous and logged-in users) 
-- to insert security logs, but prevents them from reading or modifying any existing logs.
DROP POLICY IF EXISTS "Allow public insert to security_logs" ON public.security_logs;
CREATE POLICY "Allow public insert to security_logs" ON public.security_logs
FOR INSERT TO anon, authenticated WITH CHECK (true);