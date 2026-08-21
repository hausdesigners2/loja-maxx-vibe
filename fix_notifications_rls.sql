-- 1. Garantir que RLS está ativo na tabela de papéis de usuário
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Criar política para permitir que usuários autenticados leiam seus próprios papéis
DROP POLICY IF EXISTS "user_roles_select_policy" ON public.user_roles;
CREATE POLICY "user_roles_select_policy" ON public.user_roles
FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Garantir concessões de acesso à API para a tabela de papéis
GRANT SELECT ON public.user_roles TO authenticated;
GRANT SELECT ON public.user_roles TO service_role;

-- 3. Garantir que RLS está ativo na tabela de notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. Recriar a política de inserção de notificações de forma robusta
DROP POLICY IF EXISTS "admins_insert_notifications" ON public.notifications;
CREATE POLICY "admins_insert_notifications" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (
  (auth.uid() = user_id) OR 
  (SELECT role FROM public.user_roles WHERE user_id = auth.uid() LIMIT 1) = 'admin'::app_role
);

-- Garantir concessões de acesso completas à API para a tabela de notificações
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO service_role;