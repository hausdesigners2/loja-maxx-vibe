-- =================================================================
-- 1. ATIVAR RLS NAS TABELAS DE PEDIDOS
-- =================================================================
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

-- =================================================================
-- 2. CONCEDER PERMISSÕES DE API (GRANTS) - CRUCIAL PARA EVITAR ERROS
-- =================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.orders TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.order_items TO service_role;

-- Conceder permissão de uso na sequência do número do pedido (order_number)
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.orders_order_number_seq TO service_role;

-- =================================================================
-- 3. REMOVER POLÍTICAS ANTIGAS PARA EVITAR CONFLITOS
-- =================================================================
DROP POLICY IF EXISTS "Usuários veem os próprios pedidos" ON public.orders;
DROP POLICY IF EXISTS "Qualquer usuário autenticado pode criar pedidos" ON public.orders;
DROP POLICY IF EXISTS "Admins podem atualizar pedidos" ON public.orders;
DROP POLICY IF EXISTS "orders_select_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_insert_policy" ON public.orders;
DROP POLICY IF EXISTS "orders_update_policy" ON public.orders;

DROP POLICY IF EXISTS "Usuários veem itens dos próprios pedidos" ON public.order_items;
DROP POLICY IF EXISTS "Qualquer usuário autenticado pode inserir itens de pedido" ON public.order_items;
DROP POLICY IF EXISTS "order_items_select_policy" ON public.order_items;
DROP POLICY IF EXISTS "order_items_insert_policy" ON public.order_items;

-- =================================================================
-- 4. CRIAR NOVAS POLÍTICAS DE PRIVACIDADE PARA 'ORDERS'
-- =================================================================

-- SELECT: Clientes só veem seus próprios pedidos. Admins veem TODOS.
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::app_role));

-- INSERT: Clientes só podem criar pedidos vinculados ao seu próprio ID.
CREATE POLICY "orders_insert_policy" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- UPDATE: Apenas administradores podem atualizar pedidos (mudar status, etc).
CREATE POLICY "orders_update_policy" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- =================================================================
-- 5. CRIAR NOVAS POLÍTICAS DE PRIVACIDADE PARA 'ORDER_ITEMS'
-- =================================================================

-- SELECT: Clientes só veem itens dos seus próprios pedidos. Admins veem TODOS.
CREATE POLICY "order_items_select_policy" ON public.order_items
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND (orders.user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- INSERT: Clientes só podem inserir itens em pedidos que pertencem a eles.
CREATE POLICY "order_items_insert_policy" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders
      WHERE orders.id = order_items.order_id
      AND orders.user_id = auth.uid()
    )
  );