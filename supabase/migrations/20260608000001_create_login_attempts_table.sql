CREATE TABLE IF NOT EXISTS public.login_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  identifier TEXT NOT NULL, -- email or IP address
  attempt_type TEXT NOT NULL CHECK (attempt_type IN ('login', 'reset')),
  attempts INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  blocked_until TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.login_attempts ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.login_attempts TO service_role;
-- Allow authenticated users to read/write their own attempts
GRANT SELECT, INSERT, UPDATE ON TABLE public.login_attempts TO authenticated;

-- Policies: users can only see/modify their own rows
CREATE POLICY "login_attempts_select_own" ON public.login_attempts
FOR SELECT TO authenticated USING (identifier = current_setting('request.jwt.claims', true)::json ->> 'email');

CREATE POLICY "login_attempts_insert_own" ON public.login_attempts
FOR INSERT TO authenticated WITH CHECK (identifier = current_setting('request.jwt.claims', true)::json ->> 'email');

CREATE POLICY "login_attempts_update_own" ON public.login_attempts
FOR UPDATE TO authenticated USING (identifier = current_setting('request.jwt.claims', true)::json ->> 'email')
WITH CHECK (identifier = current_setting('request.jwt.claims', true)::json ->> 'email');

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier_type ON public.login_attempts (identifier, attempt_type);