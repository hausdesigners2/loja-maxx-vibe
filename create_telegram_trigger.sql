-- Re-create the Telegram notification trigger function securely
CREATE OR REPLACE FUNCTION public.handle_new_order_telegram()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  webhook_secret TEXT;
BEGIN
  -- Recupera o segredo do webhook de forma segura a partir das configurações do banco de dados
  webhook_secret := COALESCE(
    current_setting('app.settings.webhook_secret', true),
    ''
  );

  IF webhook_secret = '' THEN
    RAISE WARNING 'handle_new_order_telegram: app.settings.webhook_secret não está configurado.';
    RETURN NEW;
  END IF;

  -- Dispara a requisição HTTP assíncrona usando a extensão pg_net do Supabase com o cabeçalho de segurança
  PERFORM
    net.http_post(
      url := 'https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/telegram-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', webhook_secret
      ),
      body := jsonb_build_object(
        'order_id', NEW.id,
        'status', NEW.status
      )
    );
  RETURN NEW;
END;
$function$;