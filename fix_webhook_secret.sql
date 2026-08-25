-- 1. Define o segredo do webhook de forma segura na configuração do banco de dados (GUC)
-- Isso remove o segredo do corpo das funções, impedindo que usuários comuns o leiam via pg_proc.
ALTER DATABASE postgres SET app.settings.webhook_secret = 'secure_webhook_token_loja_maxx_2026';

-- 2. Atualiza a função de trigger de notificações push para ler o segredo dinamicamente
CREATE OR REPLACE FUNCTION public.handle_push_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  PERFORM
    net.http_post(
      url := 'https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/onesignal-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', current_setting('app.settings.webhook_secret', true)
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$function$;

-- 3. Atualiza a função de trigger do Telegram para ler o segredo dinamicamente
CREATE OR REPLACE FUNCTION public.handle_new_order_telegram()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
BEGIN
  -- Dispara a requisição HTTP assíncrona usando a extensão pg_net do Supabase com o cabeçalho de segurança
  PERFORM
    net.http_post(
      url := 'https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/telegram-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', current_setting('app.settings.webhook_secret', true)
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status
      )
    );
  RETURN NEW;
END;
$function$;