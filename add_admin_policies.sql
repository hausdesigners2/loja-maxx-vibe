-- ATENÇÃO: Execute este script no SQL Editor do seu painel do Supabase para liberar o acesso do Administrador aos perfis dos clientes.

-- 1. Permitir que administradores visualizem todos os perfis de clientes
CREATE POLICY "Admins podem ver todos os perfis" ON public.customer_profiles
FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Permitir que administradores excluam perfis de clientes
CREATE POLICY "Admins podem deletar perfis" ON public.customer_profiles
FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));