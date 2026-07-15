import { useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDownAZ, ArrowUpAZ, ChevronLeft, Pencil, Plus, Search, Trash2, Upload } from "lucide-react";
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
import { Admin2FAGuard } from "@/components/Admin2FAGuard";

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

const DEFAULT_CATEGORIES = [
  { id: "1", name: "Cereais e Grãos", slug: "cereais-e-graos", icon: "🌾", sort_order: 1, created_at: "" },
  { id: "2", name: "Massas", slug: "massas", icon: "🍝", sort_order: 2, created_at: "" },
  { id: "3", name: "Bebidas", slug: "bebidas", icon: "🥤", sort_order: 3, created_at: "" },
  { id: "4", name: "Laticínios", slug: "laticinios", icon: "🧀", sort_order: 4, created_at: "" },
  { id: "5", name: "Limpeza", slug: "limpeza", icon: "🧹", sort_order: 5, created_at: "" },
  { id: "6", name: "Biscoitos", slug: "biscoitos", icon: "🍪", sort_order: 6, created_at: "" },
  { id: "7", name: "Bazar", slug: "bazar", icon: "🛍️", sort_order: 7, created_at: "" }
];

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024; // 5MB

function mergeCategories(fetched: Category[]): Category[] {
  const map = new Map<string, Category>();
  DEFAULT_CATEGORIES.forEach(c => map.set(c.slug, c as Category));
  fetched.forEach(c => map.set(c.slug, c));
  return Array.from(map.values()).sort((a, b) => a.sort_order - b.sort_order);
}

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
    setCategories(mergeCategories(c ?? []));
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

  const compressImage = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1000; // Resizing for optimal performance & storage efficiency
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas failure"));
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Compression failure"))),
          "image/jpeg",
          0.85,
        );
      };
      img.onerror = () => reject(new Error("Imagem inválida ou corrompida."));
      img.src = url;
    });

  const onUpload = async (file: File) => {
    if (!ALLOWED_MIME.includes(file.type)) {
      toast.error("Formato inválido. Use apenas imagens JPG, PNG ou WebP.");
      return;
    }
    if (file.size > MAX_UPLOAD_SIZE) {
      toast.error("Imagem muito pesada. O tamanho máximo permitido é de 5MB.");
      return;
    }

    setUploading(true);
    try {
      const blob = await compressImage(file);
      const ext = "jpg"; // Forçando formato jpeg comprimido
      const path = `${crypto.randomUUID()}.${ext}`;
      
      const { error } = await supabase.storage
        .from("products")
        .upload(path, blob, { contentType: "image/jpeg", upsert: false });

      if (error) throw error;

      const { data } = supabase.storage.from("products").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagem enviada e otimizada com sucesso!");
    } catch (e: any) {
      toast.error(e.message || "Erro ao fazer upload da imagem.");
    } finally {
      setUploading(false);
    }
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
    const { error = null } = await supabase.from("products").delete().eq("id", id);
    if (error) return toast.error((error as any).message);
    toast.success("Produto excluído");
    reload();
  };

  // Filtra apenas categorias que possuem UUIDs válidos (ou seja, que existem no banco de dados)
  const validCategories = useMemo(() => {
    return categories.filter(c => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(c.id));
  }, [categories]);

  return (
    <Admin2FAGuard>
      <div className="min-h-screen bg-background">
        <header className="border-b border-border bg-background">
          <div className="mx-auto max-w-3xl px-4 pt-4 pb-2">
            <div className="flex items-start justify-between">
              <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
                <ChevronLeft className="h-4 w-4" /> Loja
              </Link>
              <div className="flex gap-2">
                <Button size="sm" className="gradient-primary" onClick={openNew}>
                  <Plus className="mr-1 h-4 w-4" /> Novo Produto
                </Button>
              </div>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight">Painel Administrativo</h1>
            <div className="mt-3 flex gap-6 border-b border-border select-none">
              <Link to="/admin/dashboard" className="pb-2 text-sm font-medium text-muted-foreground">
                Pedidos
              </Link>
              <span className="-mb-px border-b-2 border-primary pb-2 text-sm font-bold text-foreground">
                Produtos
              </span>
              <Link to="/admin/banners" className="pb-2 text-sm font-medium text-muted-foreground">
                Banners
              </Link>
              <Link to="/admin/notifications" className="pb-2 text-sm font-medium text-muted-foreground">
                Notificações
              </Link>
              <Link to="/admin/sounds" className="pb-2 text-sm font-medium text-muted-foreground">
                Sons
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
              {products.length === 0 ? 'Nenhum produto cadastrado. Clique em "Novo Produto" para cadastrar o primeiro.' : "Nenhum produto encontrado."}
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
                    {validCategories.map((c) => (
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
    </Admin2FAGuard>
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