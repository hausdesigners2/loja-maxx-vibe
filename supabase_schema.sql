-- =============================================================================
-- SCRIPT DE MIGRAÇÃO FINAL - LOJAS MAXX
-- Execute este script no SQL Editor do seu painel do Supabase
-- =============================================================================

-- Limpeza prévia de objetos existentes para garantir execução limpa
DROP TRIGGER IF EXISTS trigger_update_products_updated_at ON public.products;
DROP TRIGGER IF EXISTS trigger_update_banners_updated_at ON public.banners;
DROP TRIGGER IF EXISTS trigger_update_customer_profiles_updated_at ON public.customer_profiles;
DROP TRIGGER IF EXISTS trigger_update_orders_updated_at ON public.orders;
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
DROP FUNCTION IF EXISTS public.has_role(UUID, public.app_role) CASCADE;

-- 1. Extensões e Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- 2. Tabela de Categorias
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Tabela de Produtos
CREATE TABLE IF NOT EXISTS public.products (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC(10,2) NOT NULL,
  discount_percent INT DEFAULT 0 NOT NULL,
  image_url TEXT,
  is_best_seller BOOLEAN DEFAULT false NOT NULL,
  is_featured BOOLEAN DEFAULT false NOT NULL,
  active BOOLEAN DEFAULT true NOT NULL,
  stock INT DEFAULT 0 NOT NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Tabela de Banners
CREATE TABLE IF NOT EXISTS public.banners (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT,
  subtitle TEXT,
  image_url TEXT NOT NULL,
  link_url TEXT,
  button_text TEXT,
  active BOOLEAN DEFAULT true NOT NULL,
  sort_order INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Tabela de Perfis de Clientes (Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.customer_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  address TEXT NOT NULL,
  complement TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 6. Tabela de Pedidos (Orders - Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number SERIAL UNIQUE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_address TEXT NOT NULL,
  customer_complement TEXT,
  customer_city TEXT,
  customer_state TEXT,
  customer_zip TEXT,
  total NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL,
  change_for NUMERIC(10,2),
  notes TEXT,
  status TEXT DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 7. Tabela de Itens do Pedido
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID REFERENCES public.products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit_price NUMERIC(10,2) NOT NULL,
  discount_percent INT DEFAULT 0 NOT NULL,
  quantity INT NOT NULL,
  subtotal NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 8. Tabela de Favoritos (Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.favorites (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, product_id)
);

-- 9. Tabela de Histórico de Buscas (Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.search_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  term TEXT NOT NULL,
  results_count INT DEFAULT 0 NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 10. Tabela de Logs de Segurança (Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.security_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB,
  user_agent TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 11. Tabela de Funções/Roles de Usuários (Vinculado ao auth.users)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role DEFAULT 'user'::public.app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  UNIQUE(user_id, role)
);

-- =============================================================================
-- FUNÇÕES E TRIGGERS AUTOMÁTICOS
-- =============================================================================

-- Função genérica para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicação dos triggers de updated_at
CREATE TRIGGER trigger_update_products_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_banners_updated_at
  BEFORE UPDATE ON public.banners
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_customer_profiles_updated_at
  BEFORE UPDATE ON public.customer_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trigger_update_orders_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função de verificação de permissão (has_role)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  );
END;
$$;

-- Função para criar perfil automático após o cadastro (Trigger de Autenticação)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.customer_profiles (user_id, email, full_name, phone, address, city, state, zip)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', 'Novo Cliente'),
    COALESCE(NEW.raw_user_meta_data ->> 'phone', '—'),
    COALESCE(NEW.raw_user_meta_data ->> 'address', '—'),
    '—',
    '—',
    '—'
  );
  RETURN NEW;
END;
$$;

-- Trigger para disparar a função após a criação do usuário no auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================================================
-- CONFIGURAÇÃO DE GRANTS (PERMISSÕES API)
-- =============================================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON public.products, public.categories, public.banners TO anon;

-- Permissões de sequências para inserções automáticas
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO service_role;

-- =============================================================================
-- ROW LEVEL SECURITY (RLS) E POLÍTICAS DE ACESSO
-- =============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.banners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Políticas para Categorias (Leitura pública, escrita admin)
CREATE POLICY "Permitir leitura pública de categorias" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam categorias" ON public.categories FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para Produtos (Leitura pública, escrita admin)
CREATE POLICY "Permitir leitura pública de produtos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam produtos" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para Banners (Leitura pública, escrita admin)
CREATE POLICY "Permitir leitura pública de banners" ON public.banners FOR SELECT USING (true);
CREATE POLICY "Admins gerenciam banners" ON public.banners FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));

-- Políticas para Perfis de Clientes (Usuário vê/edita o próprio perfil, admin vê todos)
CREATE POLICY "Usuários veem o próprio perfil" ON public.customer_profiles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Usuários criam o próprio perfil" ON public.customer_profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Usuários atualizam o próprio perfil" ON public.customer_profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Políticas para Pedidos e Itens (Usuário vê os próprios, admin vê todos)
CREATE POLICY "Usuários veem os próprios pedidos" ON public.orders FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Qualquer usuário autenticado pode criar pedidos" ON public.orders FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admins podem atualizar pedidos" ON public.orders FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Usuários veem itens dos próprios pedidos" ON public.order_items FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.orders WHERE id = order_id AND (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin')))
);
CREATE POLICY "Qualquer usuário autenticado pode inserir itens de pedido" ON public.order_items FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para Favoritos
CREATE POLICY "Usuários gerenciam os próprios favoritos" ON public.favorites FOR ALL TO authenticated USING (auth.uid() = user_id);

-- Políticas para Histórico de Buscas
CREATE POLICY "Admins veem histórico de buscas" ON public.search_history FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Permitir inserção de buscas" ON public.search_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id OR auth.uid() IS NULL);

-- Políticas para Logs de Segurança
CREATE POLICY "Admins veem logs de segurança" ON public.security_logs FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Permitir inserção de logs de segurança" ON public.security_logs FOR INSERT TO authenticated WITH CHECK (true);

-- Políticas para Roles de Usuários
CREATE POLICY "Usuários veem as próprias roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins gerenciam roles" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'));