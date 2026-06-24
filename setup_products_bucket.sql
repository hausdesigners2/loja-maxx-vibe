-- 1. Criar o bucket público chamado 'products' (se ele já não existir)
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Remover políticas antigas se existirem para evitar o erro "policy already exists"
DROP POLICY IF EXISTS "Leitura pública de produtos" ON storage.objects;
DROP POLICY IF EXISTS "Admins podem gerenciar imagens de produtos" ON storage.objects;

-- 3. Criar política de leitura pública para que qualquer pessoa possa ver as imagens dos produtos
CREATE POLICY "Leitura pública de produtos" ON storage.objects
  FOR SELECT USING (bucket_id = 'products');

-- 4. Criar política de gerenciamento restrita a usuários autenticados com a role 'admin'
CREATE POLICY "Admins podem gerenciar imagens de produtos" ON storage.objects
  FOR ALL TO authenticated
  USING (
    (bucket_id = 'products') AND 
    public.has_role(auth.uid(), 'admin'::app_role)
  )
  WITH CHECK (
    (bucket_id = 'products') AND 
    public.has_role(auth.uid(), 'admin'::app_role)
  );