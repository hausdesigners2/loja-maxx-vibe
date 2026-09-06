-- Concede privilégio de INSERT para os papéis anon e authenticated na tabela de logs de segurança
GRANT INSERT ON TABLE public.security_logs TO anon, authenticated;

-- Garante que o RLS está ativado na tabela
ALTER TABLE public.security_logs ENABLE ROW LEVEL SECURITY;

-- Remove a política se ela já existir para evitar conflitos
DROP POLICY IF EXISTS "Allow public inserts" ON public.security_logs;

-- Cria a política que permite que qualquer usuário (autenticado ou não) insira novos logs de segurança
CREATE POLICY "Allow public inserts" ON public.security_logs 
FOR INSERT TO anon, authenticated WITH CHECK (true);