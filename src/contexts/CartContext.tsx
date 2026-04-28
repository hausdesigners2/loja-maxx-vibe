import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { toast } from "sonner";

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
const STORAGE_KEY = "loja-maxx-cart";

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]"); } catch { return []; }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const add: CartContextValue["add"] = (p, qty = 1) => {
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
