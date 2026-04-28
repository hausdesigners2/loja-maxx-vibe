import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const LOCAL_KEY = "loja-maxx-favs";

export function useFavorites() {
  const { user } = useAuth();
  const [favs, setFavs] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user) {
      try { setFavs(new Set(JSON.parse(localStorage.getItem(LOCAL_KEY) || "[]"))); } catch {}
      return;
    }
    supabase.from("favorites").select("product_id").eq("user_id", user.id).then(({ data }) => {
      setFavs(new Set((data ?? []).map((d) => d.product_id)));
    });
  }, [user]);

  const toggle = useCallback(async (productId: string) => {
    const isFav = favs.has(productId);
    const next = new Set(favs);
    isFav ? next.delete(productId) : next.add(productId);
    setFavs(next);

    if (!user) {
      localStorage.setItem(LOCAL_KEY, JSON.stringify([...next]));
      return;
    }
    if (isFav) {
      await supabase.from("favorites").delete().match({ user_id: user.id, product_id: productId });
    } else {
      await supabase.from("favorites").insert({ user_id: user.id, product_id: productId });
    }
  }, [favs, user]);

  return { favs, toggle, isFav: (id: string) => favs.has(id) };
}
