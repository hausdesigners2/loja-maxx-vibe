import { useEffect, useState } from "react";
import banner1 from "@/assets/banner-1.jpg";
import banner2 from "@/assets/banner-2.jpg";
import { cn } from "@/lib/utils";

const slides = [
  { img: banner1, title: "Mercado em casa", subtitle: "Frete rápido e preços baixos todo dia" },
  { img: banner2, title: "Ofertas Maxx", subtitle: "Até 40% OFF em bebidas e laticínios" },
];

export function HeroBanner() {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % slides.length), 5000);
    return () => clearInterval(t);
  }, []);
  return (
    <div className="relative overflow-hidden rounded-2xl shadow-card">
      <div className="relative aspect-[16/9] w-full">
        {slides.map((s, i) => (
          <img key={i} src={s.img} alt={s.title}
            className={cn(
              "absolute inset-0 h-full w-full object-cover transition-opacity duration-700",
              i === idx ? "opacity-100" : "opacity-0"
            )} />
        ))}
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
        <div className="absolute inset-0 flex flex-col justify-center gap-1 p-5">
          <h2 className="text-2xl font-extrabold leading-tight">{slides[idx].title}</h2>
          <p className="max-w-[60%] text-xs text-muted-foreground">{slides[idx].subtitle}</p>
        </div>
        <div className="absolute bottom-3 right-3 flex gap-1.5">
          {slides.map((_, i) => (
            <button key={i} onClick={() => setIdx(i)} aria-label={`Slide ${i + 1}`}
              className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-6 bg-primary" : "w-1.5 bg-foreground/40")} />
          ))}
        </div>
      </div>
    </div>
  );
}
