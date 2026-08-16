-- 1. Inserir as categorias faltantes caso não existam no banco de dados
INSERT INTO public.categories (name, slug, icon, sort_order)
SELECT 'Biscoitos', 'biscoitos', '🍪', 6
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'biscoitos');

INSERT INTO public.categories (name, slug, icon, sort_order)
SELECT 'Bazar', 'bazar', '🛍️', 7
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'bazar');

INSERT INTO public.categories (name, slug, icon, sort_order)
SELECT 'Padaria', 'padaria', '🥖', 8
WHERE NOT EXISTS (SELECT 1 FROM public.categories WHERE slug = 'padaria');

-- 2. Garantir permissões de acesso para a API do Supabase
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.categories TO service_role;

-- 3. Criar políticas de RLS para permitir que administradores gerenciem as categorias
DROP POLICY IF EXISTS "Admins podem inserir categorias" ON public.categories;
CREATE POLICY "Admins podem inserir categorias" ON public.categories
FOR INSERT TO authenticated WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins podem atualizar categorias" ON public.categories;
CREATE POLICY "Admins podem atualizar categorias" ON public.categories
FOR UPDATE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Admins podem deletar categorias" ON public.categories;
CREATE POLICY "Admins podem deletar categorias" ON public.categories
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));