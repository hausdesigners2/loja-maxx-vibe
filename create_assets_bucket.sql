-- Criar o bucket 'assets' se ele não existir e defini-lo como público
INSERT INTO storage.buckets (id, name, public)
VALUES ('assets', 'assets', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Remover políticas antigas se existirem para evitar conflitos
DROP POLICY IF EXISTS "Acesso público de leitura para assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir upload para usuários autenticados em assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir atualização para usuários autenticados em assets" ON storage.objects;
DROP POLICY IF EXISTS "Permitir exclusão para usuários autenticados em assets" ON storage.objects;

-- Criar política de acesso público para leitura de arquivos no bucket 'assets'
CREATE POLICY "Acesso público de leitura para assets" ON storage.objects
  FOR SELECT USING (bucket_id = 'assets');

-- Criar políticas para permitir que administradores/usuários autenticados gerenciem os arquivos
CREATE POLICY "Permitir upload para usuários autenticados em assets" ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (bucket_id = 'assets');

CREATE POLICY "Permitir atualização para usuários autenticados em assets" ON storage.objects
  FOR UPDATE TO authenticated USING (bucket_id = 'assets');

CREATE POLICY "Permitir exclusão para usuários autenticados em assets" ON storage.objects
  FOR DELETE TO authenticated USING (bucket_id = 'assets');