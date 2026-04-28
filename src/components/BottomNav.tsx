import { Link, useLocation, useNavigate } from "react-router-dom";
import { Home, ShoppingCart, Heart, User, Search } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { cn } from "@/lib/utils";

const items = [
  { to: "/", icon: Home, label: "Início" },
  { to: "/buscar", icon: Search, label: "Buscar" },
  { to: "/favoritos", icon: Heart, label: "Favoritos" },
  { to: "/carrinho", icon: ShoppingCart, label: "Carrinho", badge: true },
  { to: "/conta", icon: User, label: "Conta" },
];

export function BottomNav() {
  const { pathname } = useLocation();
  const { count } = useCart();
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-card/95 backdrop-blur-lg">
      <div className="mx-auto flex max-w-xl items-center justify-around px-2 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]">
        {items.map((it) => {
          const active = pathname === it.to;
          const Icon = it.icon;
          return (
            <Link key={it.to} to={it.to}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-xs transition-colors",
                active ? "text-primary" : "text-muted-foreground hover:text-foreground"
              )}>
              <div className="relative">
                <Icon className={cn("h-5 w-5", active && "fill-primary/20")} />
                {it.badge && count > 0 && (
                  <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">
                    {count}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
