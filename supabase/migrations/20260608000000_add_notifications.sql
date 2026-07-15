-- 1. Safely add columns to customer_profiles if they do not exist
ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS receive_promotions BOOLEAN DEFAULT TRUE;

ALTER TABLE public.customer_profiles 
ADD COLUMN IF NOT EXISTS notification_sound BOOLEAN DEFAULT TRUE;

-- 2. Create public.notifications table if it does not exist
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'promotion' | 'coupon' | 'warning' | 'order'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 3. Enable Data API Grants (REQUIRED)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.notifications TO service_role;
GRANT SELECT, UPDATE ON TABLE public.notifications TO authenticated;

-- 4. Enable RLS (REQUIRED)
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 5. Create policies for users to read and update their own notifications
CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notifications as read" ON public.notifications
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Admins can do everything on notifications" ON public.notifications
  FOR ALL TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));