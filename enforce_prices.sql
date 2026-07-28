-- 1. Cria ou substitui a função que busca e valida o preço real e desconto do produto
CREATE OR REPLACE FUNCTION public.validate_order_item_price()
RETURNS TRIGGER AS $$
DECLARE
  real_price NUMERIC;
  real_discount INTEGER;
BEGIN
  -- Busca o preço real e o desconto na tabela de produtos usando os nomes corretos das colunas
  SELECT price, discount_percent INTO real_price, real_discount
  FROM public.products 
  WHERE id = NEW.product_id;

  -- Se o produto não for encontrado, lança uma exceção
  IF real_price IS NULL THEN
    RAISE EXCEPTION 'Produto não encontrado.';
  END IF;

  -- Força o preço unitário e desconto corretos no item do pedido antes de salvar
  NEW.unit_price := real_price;
  NEW.discount_percent := real_discount;
  
  -- Recalcula o subtotal de forma segura para evitar qualquer adulteração pelo cliente
  NEW.subtotal := (real_price * (1.0 - (real_discount::numeric / 100.0))) * NEW.quantity;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Garante que a trigger antiga seja removida antes de criar a nova
DROP TRIGGER IF EXISTS enforce_order_item_price ON public.order_items;

-- 3. Cria a trigger para executar a função antes de cada inserção na tabela order_items
CREATE TRIGGER enforce_order_item_price
BEFORE INSERT ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.validate_order_item_price();

-- 4. Cria ou substitui a função para atualizar automaticamente o total do pedido com base nos itens reais
CREATE OR REPLACE FUNCTION public.update_order_total()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.orders
  SET total = (
    SELECT COALESCE(SUM(subtotal), 0)
    FROM public.order_items
    WHERE order_id = COALESCE(NEW.order_id, OLD.order_id)
  )
  WHERE id = COALESCE(NEW.order_id, OLD.order_id);
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 5. Garante que a trigger de atualização de total seja removida antes de criar a nova
DROP TRIGGER IF EXISTS update_order_total_trigger ON public.order_items;

-- 6. Cria a trigger para atualizar o total do pedido após qualquer alteração nos itens
CREATE TRIGGER update_order_total_trigger
AFTER INSERT OR UPDATE OR DELETE ON public.order_items
FOR EACH ROW EXECUTE FUNCTION public.update_order_total();