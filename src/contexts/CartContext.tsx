import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export interface CartItem {
  id: string;
  name: string;
  price: number;
  discount_percent: number;
  image_url: string | null;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  count: number;
  add: (p: Omit<CartItem, "quantity">, qty?: number) => void;
  remove: (id: string) => void;
  setQty: (id: string, qty: number) => void;
  clear: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);

const GUEST_KEY = "loja-maxx-cart:guest";
const userKey = (uid: string) => `loja-maxx-cart:u:${uid}`;
const ADMIN_FLAG_KEY = "loja-maxx-cart:isAdmin";

function readCart(key: string): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [storageKey, setStorageKey] = useState<string | null>(null);
  const [isAdminCart, setIsAdminCart] = useState(false);
  const [items, setItems] = useState<CartItem[]>([]);
  const hydrated = useRef(false);

  // Resolve which cart to load whenever auth changes
  useEffect(() => {
    let active = true;

    const resolve = async (userId: string | null) => {
      if (!active) return;
      if (!userId) {
        setIsAdminCart(false);
        setStorageKey(GUEST_KEY);
        setItems(readCart(GUEST_KEY));
        hydrated.current = true;
        return;
      }
      // Check admin — admins do not have a shopping cart
      let admin = false;
      try {
        const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
        admin = data === true;
      } catch {
        admin = false;
      }
      if (!active) return;
      setIsAdminCart(admin);
      if (admin) {
        setStorageKey(null);
        setItems([]);
        hydrated.current = true;
        return;
      }
      const key = userKey(userId);
      setStorageKey(key);
      setItems(readCart(key));
      hydrated.current = true;
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void resolve(session?.user?.id ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      hydrated.current = false;
      setItems([]);
      setTimeout(() => { void resolve(session?.user?.id ?? null); }, 0);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Persist only to the active user's key (never write across users / never write for admin)
  useEffect(() => {
    if (!hydrated.current || !storageKey || isAdminCart) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {
      /* ignore */
    }
  }, [items, storageKey, isAdminCart]);

  const guard = () => {
    if (isAdminCart) {
      toast.error("Administradores não possuem carrinho de compras.");
      return false;
    }
    return true;
  };

  const add: CartContextValue["add"] = (p, qty = 1) => {
    if (!guard()) return;
    setItems((prev) => {
      const existing = prev.find((x) => x.id === p.id);
      if (existing) {
        return prev.map((x) => x.id === p.id ? { ...x, quantity: x.quantity + qty } : x);
      }
      return [...prev, { ...p, quantity: qty }];
    });
    toast.success(`${p.name} adicionado ao carrinho`);
  };

  const remove = (id: string) => setItems((prev) => prev.filter((x) => x.id !== id));
  const setQty = (id: string, qty: number) => {
    if (qty <= 0) return remove(id);
    setItems((prev) => prev.map((x) => x.id === id ? { ...x, quantity: qty } : x));
  };
  const clear = () => setItems([]);

  const count = items.reduce((s, x) => s + x.quantity, 0);

  return (
    <CartContext.Provider value={{ items, count, add, remove, setQty, clear }}>
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};

// Remove legacy shared cart key from any device that still has it
if (typeof window !== "undefined") {
  try { localStorage.removeItem("loja-maxx-cart"); localStorage.removeItem(ADMIN_FLAG_KEY); } catch { /* ignore */ }
}
