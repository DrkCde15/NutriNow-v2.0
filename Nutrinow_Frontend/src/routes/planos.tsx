import { useEffect, useMemo, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Dumbbell, Apple, Plus, Pencil, Trash2, Clock, X, Sparkles, CalendarDays } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/planos")({
  component: PlanosPage,
  head: () => ({
    meta: [
      { title: "Meus planos - NutriNow" },
      { name: "description", content: "Gerencie suas dietas e treinos personalizados." },
    ],
  }),
});

type Tipo = "treino" | "dieta";

interface Plan {
  id: number;
  tipo: Tipo;
  title: string;
  description: string;
  time?: string | null;
}

function PlanosPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tipo>("treino");
  const [items, setItems] = useState<Plan[]>([]);
  const [editing, setEditing] = useState<Plan | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", description: "", time: "" });

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  const loadItems = async () => {
    if (!token) return;
    setLoading(true);
    setError("");

    try {
      const result = await apiRequest<{ success: boolean; items: Plan[] }>(`/dieta-treino?tipo=${tab}`, {
        method: "GET",
        token,
      });
      setItems(result.items ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      if (msg.includes("Falha ao buscar itens") || (err as any).status === 404) {
        setItems([]);
      } else {
        setError(msg || "Erro ao carregar planos");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, token]);

  const visible = useMemo(() => items.filter((i) => i.tipo === tab), [items, tab]);

  const openNew = () => {
    setEditing(null);
    setForm({ title: "", description: "", time: "" });
    setOpen(true);
  };

  const openEdit = (item: Plan) => {
    setEditing(item);
    setForm({ title: item.title, description: item.description, time: item.time ?? "" });
    setOpen(true);
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setSaving(true);
    setError("");

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      time: form.time.trim() || null,
      tipo: tab,
    };

    try {
      if (editing) {
        await apiRequest(`/dieta-treino/${editing.id}`, {
          method: "PUT",
          token,
          body: JSON.stringify(payload),
        });
      } else {
        await apiRequest("/dieta-treino", {
          method: "POST",
          token,
          body: JSON.stringify(payload),
        });
      }

      setOpen(false);
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar item");
    } finally {
      setSaving(false);
    }
  };

  const onDelete = async (id: number) => {
    if (!token) return;
    if (!confirm("Excluir este item?")) return;

    setError("");
    try {
      await apiRequest(`/dieta-treino/${id}`, { method: "DELETE", token });
      await loadItems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir item");
    }
  };

  if (!user) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-6xl px-6 py-12">
        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
              <Sparkles className="h-3.5 w-3.5" /> Ola, {user.nome.split(" ")[0]}
            </span>
            <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">Meus planos</h1>
            <p className="mt-2 text-muted-foreground">Organize sua semana de treinos e refeicoes em um so lugar.</p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex items-center gap-2 self-start rounded-full bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow md:self-auto"
          >
            <Plus className="h-4 w-4" /> Adicionar
          </button>
        </div>

        <div className="mt-8 inline-flex rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setTab("treino")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-smooth ${
              tab === "treino" ? "bg-gradient-hero text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Dumbbell className="h-4 w-4" /> Treinos
          </button>
          <button
            onClick={() => setTab("dieta")}
            className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-smooth ${
              tab === "dieta" ? "bg-gradient-hero text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Apple className="h-4 w-4" /> Dietas
          </button>
        </div>

        {error && <p className="mt-4 text-sm font-medium text-destructive">{error}</p>}

        {loading ? (
          <div className="mt-10 rounded-3xl border border-border bg-card p-12 text-center text-muted-foreground">
            Carregando planos...
          </div>
        ) : visible.length === 0 ? (
          <div className="mt-10 rounded-3xl border border-dashed border-border bg-card p-12 text-center">
            <CalendarDays className="mx-auto h-10 w-10 text-muted-foreground" />
            <h3 className="mt-4 font-display text-lg font-semibold">
              Nenhum {tab === "treino" ? "treino" : "refeicao"} cadastrado
            </h3>
            <p className="mt-2 text-sm text-muted-foreground">Comece adicionando seu primeiro item.</p>
            <button
              onClick={openNew}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-gradient-hero px-5 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              <Plus className="h-4 w-4" /> Adicionar agora
            </button>
          </div>
        ) : (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((item) => (
              <article
                key={item.id}
                className="group relative flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm transition-smooth hover:-translate-y-1 hover:shadow-elegant"
              >
                <div className="flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                      tab === "treino" ? "bg-accent/40 text-foreground" : "bg-primary/10 text-primary"
                    }`}
                  >
                    {tab === "treino" ? <Dumbbell className="h-5 w-5" /> : <Apple className="h-5 w-5" />}
                  </span>
                  <div className="flex gap-1 opacity-0 transition-smooth group-hover:opacity-100">
                    <button
                      onClick={() => openEdit(item)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-smooth hover:text-foreground"
                      aria-label="Editar"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(item.id)}
                      className="rounded-lg border border-border p-2 text-muted-foreground transition-smooth hover:text-destructive"
                      aria-label="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <h3 className="mt-4 font-display text-lg font-semibold">{item.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.description}</p>
                {item.time && (
                  <span className="mt-4 inline-flex items-center gap-1.5 self-start rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
                    <Clock className="h-3 w-3" /> {item.time}
                  </span>
                )}
              </article>
            ))}
          </div>
        )}
      </main>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <div className="w-full max-w-lg rounded-3xl bg-card p-6 shadow-elegant sm:p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold">
                  {editing ? "Editar" : "Adicionar"} {tab === "treino" ? "treino" : "refeicao"}
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">Preencha os detalhes abaixo.</p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-secondary" aria-label="Fechar">
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={onSubmit} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Titulo</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder={tab === "treino" ? "Ex: Treino de pernas" : "Ex: Cafe da manha"}
                  required
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Descricao</span>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Detalhes..."
                  rows={4}
                  required
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Horario (opcional)</span>
                <input
                  type="text"
                  value={form.time}
                  onChange={(e) => setForm({ ...form, time: e.target.value })}
                  placeholder="Ex: 08:00 ou Pos-treino"
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-smooth hover:bg-secondary">
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex-1 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {saving ? "Salvando..." : editing ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
