-- ====================================================================
-- LOJAS MAXX — CORREÇÃO DEFINITIVA DE POLÍTICAS RLS ADMINISTRATIVAS
-- Remove a exigência de 2FA (aal2) para permitir acesso com login simples
-- ====================================================================

-- 1. TABELA: BANNERS
-- Remove as políticas antigas que exigiam aal2 (MFA)
DROP POLICY IF EXISTS "Admins podem inserir banners" ON public.banners;
DROP POLICY IF EXISTS "Admins podem atualizar banners" ON public.banners;
DROP POLICY IF EXISTS "Admins podem deletar banners" ON public.banners;
DROP POLICY IF EXISTS "Permitir leitura pública de banners" ON public.banners;

-- Habilita RLS e concede permissões de API
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banners TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.banners TO service_role;
GRANT SELECT ON TABLE public.banners TO anon;

-- Cria as novas políticas simplificadas e seguras baseadas apenas na role 'admin'
CREATE POLICY "Admins podem inserir banners" ON public.banners
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar banners" ON public.banners
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar banners" ON public.banners
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Permitir leitura pública de banners" ON public.banners
  FOR SELECT USING (true);


-- 2. TABELA: PRODUCTS
-- Remove as políticas antigas que exigiam aal2 (MFA)
DROP POLICY IF EXISTS "Admins podem inserir produtos" ON public.products;
DROP POLICY IF EXISTS "Admins podem atualizar produtos" ON public.products;
DROP POLICY IF EXISTS "Admins podem deletar produtos" ON public.products;

-- Garante RLS e permissões
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.products TO service_role;

-- Cria as novas políticas para produtos
CREATE POLICY "Admins podem inserir produtos" ON public.products
  FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem atualizar produtos" ON public.products
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar produtos" ON public.products
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));


-- 3. TABELA: ORDERS
-- Remove as políticas antigas que exigiam aal2 (MFA)
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;

-- Garante RLS e permissões
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;

-- Cria as novas políticas para pedidos
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT TO authenticated USING ((auth.uid() = user_id) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "orders_update_policy" ON public.orders
  FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));


-- 4. TABELA: CUSTOMER_PROFILES
-- Remove as políticas antigas que exigiam aal2 (MFA)
DROP POLICY IF EXISTS "Admins podem ver todos os perfis" ON public.customer_profiles;
DROP POLICY IF EXISTS "Admins podem deletar perfis" ON public.customer_profiles;

-- Garante RLS e permissões
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.customer_profiles TO service_role;

-- Cria as novas políticas para perfis de clientes
CREATE POLICY "Admins podem ver todos os perfis" ON public.customer_profiles
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins podem deletar perfis" ON public.customer_profiles
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));