
-- Tighten RLS on orders and order_items
-- Clients must be authenticated and can only create orders/items linked to themselves.
-- Clients cannot update/delete (no policy = denied). Admins keep full control.

DROP POLICY IF EXISTS "Anyone can create order" ON public.orders;
CREATE POLICY "Authenticated users create own orders"
  ON public.orders FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Anyone can insert order items" ON public.order_items;
CREATE POLICY "Users insert items for own orders"
  ON public.order_items FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND o.user_id = auth.uid()
    )
  );
