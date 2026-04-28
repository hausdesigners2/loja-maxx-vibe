import { Link } from "react-router-dom";
import { ShoppingBag, ShoppingCart } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

export function TopBar() {
  const { count } = useCart();
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-lg">
      <div className="mx-auto flex max-w-xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl gradient-primary shadow-glow">
            <ShoppingBag className="h-5 w-5 text-primary-foreground" />
          </div>
          <div className="leading-tight">
            <h1 className="text-base font-extrabold tracking-tight">Loja Maxx</h1>
            <p className="text-[10px] text-muted-foreground">Mercado online</p>
          </div>
        </Link>
        <Link to="/carrinho" className="relative grid h-10 w-10 place-items-center rounded-full bg-secondary">
          <ShoppingCart className="h-5 w-5" />
          {count > 0 && (
            <span className="absolute -right-1 -top-1 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-xs font-bold text-primary-foreground">
              {count}
            </span>
          )}
        </Link>
      </div>
    </header>
  );
}
