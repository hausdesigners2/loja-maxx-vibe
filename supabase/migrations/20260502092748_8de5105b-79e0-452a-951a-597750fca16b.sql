DROP POLICY IF EXISTS "Anyone can insert security logs" ON public.security_logs;

CREATE POLICY "Insert allowed security events"
ON public.security_logs FOR INSERT
TO anon, authenticated
WITH CHECK (
  event_type IN (
    'login_success',
    'login_failed',
    'signup_success',
    'signup_failed',
    'logout',
    'admin_access',
    'admin_access_denied',
    'session_timeout',
    'password_reset_requested'
  )
  AND length(coalesce(email, '')) <= 320
  AND length(event_type) <= 64
);