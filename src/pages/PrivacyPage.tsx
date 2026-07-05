import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ShieldCheck } from "lucide-react";
import { AppShell } from "@/components/AppShell";
import { PrivacyPolicyContent, PRIVACY_VERSION } from "@/components/LegalDocuments";

export default function PrivacyPage() {
  return (
    <AppShell>
      <div className="space-y-5 animate-fade-in pb-8">
        <Link to="/auth" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="h-4 w-4" /> Voltar para o cadastro
        </Link>

        <header className="relative overflow-hidden rounded-2xl bg-card p-5 shadow-card border border-border/40">
          <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-primary/10 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="grid h-12 w-12 place-items-center rounded-2xl gradient-primary text-primary-foreground shadow-glow">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight">Política de Privacidade</h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Última atualização: {PRIVACY_VERSION}
              </p>
            </div>
          </div>
        </header>

        <div className="rounded-2xl bg-card p-5 border border-border/40 shadow-card">
          <PrivacyPolicyContent />
        </div>
      </div>
    </AppShell>
  );
}