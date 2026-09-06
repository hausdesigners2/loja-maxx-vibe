-- 1. Set the secure webhook secret in the database configuration
-- Replace 'secure_webhook_token_loja_maxx_2026' with a secure random string in production
ALTER DATABASE postgres SET app.settings.webhook_secret = 'secure_webhook_token_loja_maxx_2026';

-- 2. Update handle_push_notification_webhook to retrieve the secret from GUC
CREATE OR REPLACE FUNCTION public.handle_push_notification_webhook()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  webhook_secret TEXT;
BEGIN
  webhook_secret := current_setting('app.settings.webhook_secret', true);
  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    RAISE WARNING 'app.settings.webhook_secret is not set in database configuration!';
    RETURN NEW;
  END IF;

  PERFORM
    net.http_post(
      url := 'https://tnpcrxconafliiuhszcx.supabase.co/functions/v1/onesignal-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'X-Webhook-Secret', webhook_secret
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );
  RETURN NEW;
END;
$function$;

-- 3. Update handle_new_order_telegram to retrieve the secret from GUC
CREATE OR REPLACE FUNCTION public.handle_new_order_telegram()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
DECLARE
  webhook_secret TEXT;
BEGIN
  webhook_secret := current_setting('app.settings.webhook_secret', true);
  IF webhook_secret IS NULL OR webhook_secret = '' THEN
    RAISE WARNING 'app.settings.webhook_secret is not set in database configuration!';
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