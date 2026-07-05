import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { ArrowDown, ArrowUp, ChevronLeft, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Admin2FAGuard } from "@/components/Admin2FAGuard";

type Banner = Tables<"banners">;

interface FormState {
  id?: string;
  title: string;
  subtitle: string;
  image_url: string;
  link_url: string;
  button_text: string;
  active: boolean;
}

const empty: FormState = {
  title: "", subtitle: "", image_url: "", link_url: "", button_text: "", active: true,
};

const ALLOWED = ["image/jpeg", "image/png"];
const MAX_SIZE = 5 * 1024 * 1024;

export default function AdminBannersPage() {
  const { user, isAdmin, loading } = useAuth();
  const [items, setItems] = useState<Banner[]>([]);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const reload = async () => {
    const { data } = await supabase
      .from("banners")
      .select("*")
      .order("sort_order", { ascending: true });
    setItems(data ?? []);
  };

  useEffect(() => {
    if (loading || !user || !isAdmin) return;
    reload();
  }, [loading, user, isAdmin]);

  if (loading) return <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isAdmin) return <Navigate to="/admin" replace />;

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (b: Banner) => {
    setForm({
      id: b.id,
      title: b.title ?? "",
      subtitle: b.subtitle ?? "",
      image_url: b.image_url,
      link_url: b.link_url ?? "",
      button_text: b.button_text ?? "",
      active: b.active,
    });
    setOpen(true);
  };

  const compress = (file: File): Promise<Blob> =>
    new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxW = 1600;
        const scale = Math.min(1, maxW / img.width);
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas error"));
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error("Falha na compressão"))),
          "image/jpeg",
          0.82,
        );
      };
      img.onerror = () => reject(new Error("Imagem inválida"));
      img.src = url;
    });

  const onUpload = async (file: File) => {
    if (!ALLOWED.includes(file.type)) return toast.error("Use JPG ou PNG.");
    if (file.size > MAX_SIZE) return toast.error("Imagem muito grande (máx 5MB).");
    setUploading(true);
    try {
      const blob = await compress(file);
      const path = `${crypto.randomUUID()}.${file.name.split(".").pop()}`;
      const { error } = await supabase.storage
        .from("banners")
        .upload(path, blob, { contentType: file.type, upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("banners").getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: data.publicUrl }));
      toast.success("Imagem enviada");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    if (!form.image_url) return toast.error("Envie uma imagem.");
    setSaving(true);
    const payload = {
      title: form.title.trim(),
      subtitle: form.subtitle.trim(),
      image_url: form.image_url,
      link_url: form.link_url.trim() || null,
      button_text: form.button_text.trim() || null,
      active: form.active,
    };
    const res = form.id
      ? await supabase.from("banners").update(payload).eq("id", form.id)
      : await supabase.from("banners").insert({
          ...payload,
          sort_order: items.length,
        });
    setSaving(false);
    if (res.error) return toast.error(res.error.message);
    toast.success(form.id ? "Banner atualizado" : "Banner criado");
    setOpen(false);
    reload();
  };

  const remove = async (id: string) => {
    if (!confirm("Excluir este banner?")) return;
    const { error } = await supabase.from("banners").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Banner excluído");
    reload();
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= items.length) return;
    const a = items[i];
    const b = items[j];
    const next = [...items];
    next[i] = b; next[j] = a;
    setItems(next);
    await Promise.all([
      supabase.from("banners").update({ sort_order: j }).eq("id", a.id),
      supabase.from("banners").update({ sort_order: i }).eq("id", b.id),
    ]);
    reload();
  };

  const toggleActive = async (b: Banner) => {
    const { error } = await supabase
      .from("banners")
      .update({ active: !b.active })
      .eq("id", b.id);
    if (error) return toast.error(error.message);
    reload();
  };

  return (
    <Admin2FAGuard>
      <div className="min-h-screen bg-background">
        <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link to="/admin" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
              <ChevronLeft className="h-4 w-4" /> Painel
            </Link>
            <h1 className="text-base font-bold">Gerenciar Banners</h1>
            <Button size="sm" className="gradient-primary" onClick={openNew}>
              <Plus className="mr-1 h-4 w-4" /> Novo
            </Button>
          </div>
        </header>

        <main className="mx-auto max-w-3xl space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">
            {items.length} banner(s) · tamanho ideal 1600x600 px
          </p>

          {items.map((b, i) => (
            <div key={b.id} className="flex gap-3 rounded-2xl bg-card p-3">
              <div className="aspect-[8/3] w-28 shrink-0 overflow-hidden rounded-xl bg-secondary">
                <img src={b.image_url} alt={b.title} className="h-full w-full object-cover" loading="lazy" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="truncate text-sm font-semibold">{b.title || "(sem título)"}</h3>
                <p className="truncate text-xs text-muted-foreground">{b.subtitle}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`rounded px-1.5 py-0.5 text-[10px] ${b.active ? "bg-primary/20 text-primary" : "bg-muted"}`}>
                    {b.active ? "ativo" : "inativo"}
                  </span>
                  <Switch checked={b.active} onCheckedChange={() => toggleActive(b)} />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <Button size="icon" variant="outline" onClick={() => move(i, -1)} disabled={i === 0}>
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => move(i, 1)} disabled={i === items.length - 1}>
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => openEdit(b)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" onClick={() => remove(b.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}

          {items.length === 0 && (
            <div className="rounded-2xl bg-card p-8 text-center text-sm text-muted-foreground">
              Nenhum banner. Clique em "Novo" para adicionar.
            </div>
          )}
        </main>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{form.id ? "Editar banner" : "Novo banner"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div>
                <Label>Imagem (1600x600 px, JPG ou PNG)</Label>
                <div className="mt-1 flex items-center gap-3">
                  <div className="aspect-[8/3] w-32 shrink-0 overflow-hidden rounded-xl bg-secondary">
                    {form.image_url
                      ? <img src={form.image_url} alt="preview" className="h-full w-full object-cover" />
                      : <div className="grid h-full place-items-center text-2xl text-muted-foreground">🖼️</div>}
                  </div>
                  <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm hover:bg-secondary">
                    <Upload className="h-4 w-4" />
                    {uploading ? "Enviando..." : "Carregar"}
                    <input type="file" accept="image/jpeg,image/png" className="hidden"
                      onChange={(e) => e.target.files?.[0] && onUpload(e.target.files[0])} />
                  </label>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Mantenha o conteúdo importante centralizado (área segura).
                </p>
              </div>

              <div>
                <Label>Título</Label>
                <Input value={form.title} maxLength={80} onChange={(e) => setForm({ ...form, title: e.target.value })} />
              </div>

              <div>
                <Label>Subtítulo</Label>
                <Input value={form.subtitle} maxLength={140} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Texto do botão</Label>
                  <Input value={form.button_text} maxLength={30} onChange={(e) => setForm({ ...form, button_text: e.target.value })} />
                </div>
                <div>
                  <Label>Link (URL)</Label>
                  <Input value={form.link_url} placeholder="/categoria/bebidas" onChange={(e) => setForm({ ...form, link_url: e.target.value })} />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-xl bg-secondary/50 p-3">
                <span className="text-sm">Ativo (visível na loja)</span>
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
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