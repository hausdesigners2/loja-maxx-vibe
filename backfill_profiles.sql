-- =============================================================================
-- SCRIPT DE SINCRONIZAÇÃO RETROATIVA (BACKFILL)
-- Execute este script no SQL Editor do Supabase para criar perfis para usuários existentes
-- =============================================================================

INSERT INTO public.customer_profiles (user_id, email, full_name, phone, address, city, state, zip)
SELECT 
  id,
  email,
  COALESCE(raw_user_meta_data ->> 'full_name', 'Novo Cliente'),
  COALESCE(raw_user_meta_data ->> 'phone', '—'),
  COALESCE(raw_user_meta_data ->> 'address', '—'),
  '—',
  '—',
  '—'
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;