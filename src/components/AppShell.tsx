import { ReactNode } from "react";
import { TopBar } from "./TopBar";
import { BottomNav } from "./BottomNav";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <TopBar />
      <main className="mx-auto max-w-xl px-4 pb-24 pt-4">{children}</main>
      <BottomNav />
    </div>
  );
}
