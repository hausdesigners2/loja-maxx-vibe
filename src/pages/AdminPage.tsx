import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, Pencil, Plus, Search, Trash2, Upload, Database as DbIcon, RefreshCw } from "lucide-react";
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

// Dados iniciais para migração/seed
const INITIAL_CATEGORIES = [
  { name: "Cereais e Grãos", slug: "cereais-e-graos", icon: "🌾", sort_order: 1 },
  { name: "Massas", slug: "massas", icon: "🍝", sort_order: 2 },
  { name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 3 },
  { name: "Laticínios", slug: "laticinios", icon: "🧀", sort_order: 4 },
  { name: "Limpeza", slug: "limpeza", icon: "🧹", sort_order: 5 }
];

const INITIAL_PRODUCTS = [
  { name: "Arroz Integral Tipo 1 - 1kg", description: "Arroz integral de alta qualidade, rico em fibras.", price: 8.90, discount_percent: 0, is_best_seller: true, is_featured: true, stock: 100, image_url: "https://images.unsplash.com/photo-1586201375761-83865001e31c?w=500&q=80" },
  { name: "Feijão Carioca Tipo 1 - 1kg", description: "Feijão carioca novo, cozinha rápido e rende muito.", price: 7.50, discount_percent: 10, is_best_seller: true, is_featured: true, stock: 150, image_url: "https://images.unsplash.com/photo-1551462147-ff29053bfc14?w=500&q=80" },
  { name: "Macarrão Espaguete Sêmola - 500g", description: "Macarrão espaguete perfeito para o seu almoço de domingo.", price: 4.20, discount_percent: 0, is_best_seller: false, is_featured: true, stock: 200, image_url: "https://images.unsplash.com/photo-1563379091339-03b21ab4a4f8?w=500&q=80" },
  { name: "Azeite de Oliva Extra Virgem - 500ml", description: "Azeite de oliva extra virgem importado, acidez máxima 0.5%.", price: 32.90, discount_percent: 15, is_best_seller: true, is_featured: true, stock: 50, image_url: "https://images.unsplash.com/photo-1474979266404-7eaacbcd87c5?w=500&q=80" },
  { name: "Suco de Uva Integral - 1L", description: "Suco de uva 100% integral, sem adição de açúcares ou conservantes.", price: 14.90, discount_percent: 0, is_best_seller: false, is_featured: false, stock: 80, image_url: "https://images.unsplash.com/photo-1600271886742-f049cd451bba?w=500&q=80" }
];

const INITIAL_BANNERS = [
  { title: "Super Ofertas da Semana", subtitle: "Aproveite descontos exclusivos em cereais e bebidas com entrega rápida!", button_text: "Ver Ofertas", link_url: "/categoria/cereais-e-graos", active: true, sort_order: 1, image_url: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1200&q=80" },
  { title: "Sua Dispensa Sempre Cheia", subtitle: "Compre pelo WhatsApp e receba no conforto da sua casa.", button_text: "Comprar Agora", link_url: "/", active: true, sort_order: 2, image_url: "https://images.unsplash.com/photo-1604719312566-8912e9227c6a?w=1200&q=80" }
];

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
  const [migrating, setMigrating] = useState(false);

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

  const runMigration = async () => {
    setMigrating(true);
    try {
      // 1. Criar categorias se não existirem
      const { data: existingCats } = await supabase.from("categories").select("slug");
      const existingSlugs = new Set((existingCats ?? []).map(c => c.slug));
      
      const catsToInsert = INITIAL_CATEGORIES.filter(c => !existingSlugs.has(c.slug));
      
      let insertedCats: Category[] = [];
      if (catsToInsert.length > 0) {
        const { data: newCats, error: catErr } = await supabase
          .from("categories")
          .insert(catsToInsert)
          .select();
        if (catErr) throw catErr;
        insertedCats = newCats ?? [];
        toast.success(`${catsToInsert.length} categorias criadas no Supabase!`);
      }

      // Recarregar categorias para obter os IDs corretos
      const { data: allCats } = await supabase.from("categories").select("*");
      const catMap = new Map((allCats ?? []).map(c => [c.slug, c.id]));

      // 2. Criar produtos se não existirem
      const { data: existingProds } = await supabase.from("products").select("name");
      const existingNames = new Set((existingProds ?? []).map(p => p.name));

      const prodsToInsert = INITIAL_PRODUCTS
        .filter(p => !existingNames.has(p.name))
        .map(p => {
          // Associa à categoria correta (ou a primeira disponível)
          let category_id = allCats?.[0]?.id || null;
          if (p.name.includes("Arroz") || p.name.includes("Feijão") || p.name.includes("Azeite")) {
            category_id = catMap.get("cereais-e-graos") || category_id;
          } else if (p.name.includes("Macarrão")) {
            category_id = catMap.get("massas") || category_id;
          } else if (p.name.includes("Suco")) {
            category_id = catMap.get("bebidas") || category_id;
          }
          return {
            name: p.name,
            description: p.description,
            price: p.price,
            discount_percent: p.discount_percent,
            is_best_seller: p.is_best_seller,
            is_featured: p.is_featured,
            stock: p.stock,
            image_url: p.image_url,
            category_id,
            active: true
          };
        });

      if (prodsToInsert.length > 0) {
        const { error: prodErr } = await supabase.from("products").insert(prodsToInsert);
        if (prodErr) throw prodErr;
        toast.success(`${prodsToInsert.length} produtos migrados com sucesso!`);
      }

      // 3. Criar banners se não existirem
      const { data: existingBanners } = await supabase.from("banners").select("title");
      const existingBannerTitles = new Set((existingBanners ?? []).map(b => b.title));

      const bannersToInsert = INITIAL_BANNERS.filter(b => !existingBannerTitles.has(b.title));
      if (bannersToInsert.length > 0) {
        const { error: bannerErr } = await supabase.from("banners").insert(bannersToInsert);
        if (bannerErr) throw bannerErr;
        toast.success(`${bannersToInsert.length} banners de destaque criados!`);
      }

      toast.success("Migração de dados concluída com sucesso!");
      await reload();
    } catch (err) {
      console.error("Erro na migração:", err);
      toast.error("Erro ao migrar dados: " + (err as Error).message);
    } finally {
      setMigrating(false);
    }
  };

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

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background">
        <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
          <div className="flex items-start justify-between">
            <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> Loja
            </Link>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="border-primary/40 text-primary hover:bg-primary/10" onClick={runMigration} disabled={migrating}>
                <DbIcon className="mr-1 h-4 w-4" /> {migrating ? "Migrando..." : "Migrar Dados"}
              </Button>
              <Button size="sm" className="gradient-primary" onClick={openNew}>
                <Plus className="mr-1 h-4 w-4" /> Novo
              </Button>
            </div>
          </div>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Painel Administrativo</h1>
          <div className="mt-3 flex gap-6 border-b border-border">
            <Link to="/admin/dashboard" className="pb-2 text-sm font-medium text-muted-foreground">
              Pedidos
            </Link>
            <span className="-mb-px border-b-2 border-primary pb-2 text-sm font-bold text-foreground">
              Produtos
            </span>
            <Link to="/admin/banners" className="pb-2 text-sm font-medium text-muted-foreground">
              Banners
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
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
            {products.length === 0 ? 'Nenhum produto. Clique em "Migrar Dados" ou "Novo" para cadastrar o primeiro.' : "Nenhum produto encontrado."}
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