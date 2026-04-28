import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";

export function SectionHeader({ title, to, children }: { title: string; to?: string; children?: ReactNode }) {
  return (
    <div className="mb-3 flex items-end justify-between">
      <div>
        <h2 className="text-lg font-bold tracking-tight">{title}</h2>
        {children && <p className="text-xs text-muted-foreground">{children}</p>}
      </div>
      {to && (
        <Link to={to} className="flex items-center gap-0.5 text-xs font-semibold text-primary">
          Ver tudo <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}
