-- 1. Criar a função que dispara a requisição HTTP para a Edge Function do Telegram
CREATE OR REPLACE FUNCTION public.handle_new_order_telegram()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = ''
AS $$
BEGIN
  -- Dispara a requisição HTTP assíncrona usando a extensão pg_net do Supabase
  PERFORM
    net.http_post(
      url := 'https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/telegram-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json'
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status
      )
    );
  RETURN NEW;
END;
$$;

-- 2. Criar o gatilho (trigger) na tabela de pedidos
DROP TRIGGER IF EXISTS on_order_created_telegram ON public.orders;
CREATE TRIGGER on_order_created_telegram
  AFTER INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_order_telegram();