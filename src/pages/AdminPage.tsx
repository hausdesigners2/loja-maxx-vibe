import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, Pencil, Plus, Search, Trash2, Upload, Database, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { formatBRL } from "@/lib/format";
import { SEED_CATEGORIES, SEED_PRODUCTS } from "@/lib/seedData";

type Product = Tables<"products">;
type Category = Tables<"categories">;

interface FormState {
  id?: string;
  name: string;
  description: string;
  price: string;
  discount_percent: string;
  category_id: string;
  image_url: string;
  is_best_seller: boolean;
  is_featured: boolean;
  active: boolean;
  stock: string;
}

const empty: FormState = {
  name: "", description: "", price: "0", discount_percent: "0",
  category_id: "", image_url: "", is_best_seller: false, is_featured: true, active: true, stock: "0",
};

export default function AdminPage() {
  const { user, isAdmin, loading } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [sortAsc, setSortAsc] = useState(true);
  const [activeTab, setActiveTab] = useState<"products" | "setup">("products");
  const [seeding, setSeeding] = useState(false);

  const visibleProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
    return [...filtered].sort((a, b) => {
      const cmp = a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" });
      return sortAsc ? cmp : -cmp;
    });
  }, [products, search, sortAsc]);

  const reload = async () => {
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("products").select("*").order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("sort_order"),
    ]);
    setProducts(p ?? []);
    setCategories(c ?? []);
  };

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    (async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
      const ok = !error && data === true;
      void import("@/lib/security").then(({ logSecurityEvent }) =>
        logSecurityEvent(ok ? "admin_access" : "admin_access_denied", { userId: user.id, email: user.email })
      );
      if (ok) reload();
    })();
  }, [loading, user]);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return (
    <div className="mx-auto max-w-md p-8 text-center">
      <h1 className="text-xl font-bold">Acesso negado</h1>
      <p className="mt-2 text-sm text-muted-foreground">Sua conta não tem permissão de administrador.</p>
      <Button asChild className="mt-4"><Link to="/">Voltar</Link></Button>
    </div>
  );

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (p: Product) => {
    setForm({
      id: p.id, name: p.name, description: p.description ?? "",
      price: String(p.price), discount_percent: String(p.discount_percent),
      category_id: p.category_id ?? "", image_url: p.image_url ?? "",
      is_best_seller: p.is_best_seller, is_featured: p.is_featured, active: p.active,
      stock: String(p.stock),
    });
    setOpen(true);
  };

  const onUpload = async (file: File) => {
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from("products").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("products").getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
    toast.success("Imagem carregada");
  };

  const save = async () => {
    if (!form.name || !form.category_id) { toast.error("Nome e categoria são obrigatórios."); return; }
    setSaving(true);
    const payload = {
      name: form.name, description: form.description || null,
      price: Number(form.price), discount_percent: Number(form.discount_percent),
      category_id: form.category_id, image_url: form.image_url || null,
      is_best_seller: form.is_best_seller, is_featured: form.is_featured,
      active: form.active, stock: Number(form.stock),
    };
    const res = form.id
      ? await supabase.from("products").update(payload).eq("id", form.id)
      : await supabase.from("products").insert(payload);
    setSaving(false);
    if (res.error) { toast.error(res.error.message); return; }
    toast.success(form.id ? "Produto atualizado" : "Produto criado");
    setOpen(false);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Produto excluído");
    reload();
  };

  const handleSeedDatabase = async () => {
    setSeeding(true);
    try {
      // 1. Criar categorias se não existirem
      toast.info("Criando categorias iniciais...");
      const insertedCategories: Record<string, string> = {};

      for (const cat of SEED_CATEGORIES) {
        // Verifica se já existe
        const { data: existing } = await supabase
          .from("categories")
          .select("id")
          .eq("slug", cat.slug)
          .maybeSingle();

        if (existing) {
          insertedCategories[cat.slug] = existing.id;
        } else {
          const { data: inserted, error } = await supabase
            .from("categories")
            .insert(cat)
            .select("id")
            .single();
          
          if (error) throw error;
          if (inserted) insertedCategories[cat.slug] = inserted.id;
        }
      }

      // 2. Criar produtos vinculados às categorias
      toast.info("Criando produtos iniciais...");
      let count = 0;
      for (const prod of SEED_PRODUCTS) {
        const catId = insertedCategories[prod.category_slug];
        if (!catId) continue;

        // Verifica se já existe
        const { data: existing } = await supabase
          .from("products")
          .select("id")
          .eq("name", prod.name)
          .maybeSingle();

        if (!existing) {
          const { category_slug, ...productData } = prod;
          const { error } = await supabase
            .from("products")
            .insert({
              ...productData,
              category_id: catId,
            });
          if (error) throw error;
          count++;
        }
      }

      toast.success(`Migração concluída! ${count} novos produtos adicionados.`);
      await reload();
      setActiveTab("products");
    } catch (error) {
      console.error(error);
      toast.error("Erro ao migrar dados: " + (error as Error).message);
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
          <div className="flex items-start justify-between">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> Loja
            </Link>
            {activeTab === "products" && (
              <Button size="sm" className="gradient-primary" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Button>
            )}
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Painel Administrativo</h1>
          <div className="mt-3 flex gap-6 border-b border-border">
            <Link to="/admin/dashboard" className="pb-2 text-sm font-medium text-muted-foreground">
              Pedidos
            </Link>
            <button 
              onClick={() => setActiveTab("products")}
              className={`pb-2 text-sm font-bold ${activeTab === "products" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            >
              Produtos
            </button>
            <button 
              onClick={() => setActiveTab("setup")}
              className={`pb-2 text-sm font-bold flex items-center gap-1.5 ${activeTab === "setup" ? "border-b-2 border-primary text-foreground" : "text-muted-foreground"}`}
            >
              <Database className="h-4 w-4" /> Configuração
            </button>
            <Link to="/admin/banners" className="pb-2 text-sm font-medium text-muted-foreground">
              Banners
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
        {activeTab === "products" ? (
          <>
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm text-muted-foreground">{visibleProducts.length} produto(s) cadastrado(s)</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setSortAsc((v) => !v)}
                title={sortAsc ? "Ordem A → Z" : "Ordem Z → A"}
              >
                {sortAsc ? <ArrowDownAZ className="mr-1 h-4 w-4" /> : <ArrowUpAZ className="mr-1 h-4 w-4" />}
                {sortAsc ? "A → Z" : "Z → A"}
              </Button>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar produtos cadastrados..."
                className="pl-9"
              />
            </div>

            {visibleProducts.map((p) => {
              const cat = categories.find((c) => c.id === p.category_id);
              return (
                <div key={p.id} className="flex gap-3 rounded-2xl bg-card p-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {p.image_url
                      ? <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" />
                      : <div className="grid h-full place-items-center text-2xl">📦</div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-sm font-semibold">{p.name}</h3>
                    <p className="text-xs text-muted-foreground">
                      {cat?.icon} {cat?.name} · {formatBRL(Number(p.price))}
                      {p.discount_percent > 0 && ` · -${p.discount_percent}%`}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {!p.active && <span className="rounded bg-muted px-1.5 py-0.5 text-[10px]">inativo</span>}
                      {p.is_best_seller && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">+ vendido</span>}
                      {p.is_featured && <span className="rounded bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary">destaque</span>}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button size="icon" variant="outline" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></Button>
                    <Button size="icon" variant="outline" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              );
            })}

            {visibleProducts.length === 0 && (
              <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
                {products.length === 0 ? 'Nenhum produto. Clique em "Novo" para cadastrar o primeiro.' : "Nenhum produto encontrado."}
              </div>
            )}
          </>
        ) : (
          <div className="space-y-6 animate-fade-in">
            <div className="rounded-2xl bg-card p-5 border border-border space-y-4">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Database className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">Conexão com o Supabase</h2>
                  <p className="text-xs text-muted-foreground">Status e ferramentas de migração de dados</p>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-secondary/40 border border-border space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">URL do Banco:</span>
                  <span className="font-mono text-xs truncate max-w-[250px]">{import.meta.env.VITE_SUPABASE_URL}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Status da Conexão:</span>
                  <span className="flex items-center gap-1 text-xs font-bold text-green-500">
                    <CheckCircle className="h-4 w-4" /> Conectado
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="text-sm font-bold">Migração de Dados Iniciais</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Se o seu banco de dados do Supabase estiver vazio, você pode carregar as categorias e produtos de exemplo (com imagens de alta qualidade hospedadas) diretamente para o seu banco de dados com o botão abaixo.
                </p>

                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-xs text-yellow-500">
                  <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>
                    Esta ação irá verificar se as categorias e produtos já existem no banco de dados para evitar duplicatas.
                  </span>
                </div>

                <Button 
                  onClick={handleSeedDatabase} 
                  disabled={seeding}
                  className="w-full gradient-primary shadow-glow font-bold"
                >
                  {seeding ? "Migrando dados..." : "Migrar Categorias e Produtos Iniciais"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editar produto" : "Novo produto"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Imagem</Label>
              <div className="mt-1 flex items-center gap-3">
                <div className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-secondary">
                  {form.image_url
                    ? <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
                    : <div className="grid h-full place-items-center text-2xl text-muted-foreground">📦</div>}
                </div>
                <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:bg-secondary">
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando..." : "Carregar imagem"}
                  <input type="file" accept="image/*" className="hidden"
                    onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                </label>
              </div>
              <Input className="mt-2" placeholder="ou cole uma URL" value={form.image_url}
                onChange={(e) => setForm({ ...form, image_url: e.target.value })} />
            </div>

            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>

            <div>
              <Label>Descrição</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" step="0.01" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
              </div>
              <div>
                <Label>Desconto (%)</Label>
                <Input type="number" min="0" max="100" value={form.discount_percent}
                  onChange={(e) => setForm({ ...form, discount_percent: e.target.value })} />
              </div>
            </div>

            <div>
              <Label>Categoria *</Label>
              <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Estoque</Label>
              <Input type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
            </div>

            <div className="space-y-2 rounded-xl bg-secondary/50 p-3">
              <ToggleRow label="Ativo (visível na loja)" v={form.active} onChange={(v) => setForm({ ...form, active: v })} />
              <ToggleRow label="Mais vendido" v={form.is_best_seller} onChange={(v) => setForm({ ...form, is_best_seller: v })} />
              <ToggleRow label="Em destaque" v={form.is_featured} onChange={(v) => setForm({ ...form, is_featured: v })} />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={save} disabled={saving} className="gradient-primary">
              {saving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ToggleRow({ label, v, onChange }: { label: string; v: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm">{label}</span>
      <Switch checked={v} onCheckedChange={onChange} />
    </div>
  );
}