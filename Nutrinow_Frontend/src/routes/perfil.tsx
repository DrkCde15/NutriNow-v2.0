import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { User as UserIcon, Mail, Camera, LogOut, Save, Check, Trash2, Sparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/perfil")({
  component: PerfilPage,
  head: () => ({
    meta: [
      { title: "Meu perfil â€” NutriNow" },
      { name: "description", content: "Gerencie seu perfil, avatar e preferencias no NutriNow." },
    ],
  }),
});

interface PerfilResponse {
  nome: string;
  sobrenome: string;
  genero: "Masculino" | "Feminino";
  email: string;
  dataNascimento: string;
  meta: string;
  altura: number | null;
  peso: number | null;
  ja_treinou: string;
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

function PerfilPage() {
  const { user, token, updateUser, logout } = useAuth();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);

  const [nome, setNome] = useState(user?.nome ?? "");
  const [sobrenome, setSobrenome] = useState("");
  const [genero, setGenero] = useState<"Masculino" | "Feminino">("Masculino");
  const [dataNascimento, setDataNascimento] = useState("");
  const [email, setEmail] = useState(user?.email ?? "");
  const [meta, setMeta] = useState("Nao definida");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [jaTreinou, setJaTreinou] = useState("Nunca treinou");
  const [avatar, setAvatar] = useState<string | undefined>(user?.avatar);
  const [initialAvatar, setInitialAvatar] = useState<string | undefined>(user?.avatar);
  const [initialForm, setInitialForm] = useState({
    nome: user?.nome ?? "",
    sobrenome: "",
    genero: "Masculino" as "Masculino" | "Feminino",
    dataNascimento: "",
    email: user?.email ?? "",
    meta: "Nao definida",
    altura: "",
    peso: "",
    jaTreinou: "Nunca treinou",
  });
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  useEffect(() => {
    const loadPerfil = async () => {
      if (!token) return;
      setLoading(true);
      setError("");

      try {
        const data = await apiRequest<PerfilResponse>("/perfil", { method: "GET", token });
        setNome(data.nome ?? "");
        setSobrenome(data.sobrenome ?? "");
        setGenero(data.genero ?? "Masculino");
        setDataNascimento(data.dataNascimento ?? "");
        setEmail(data.email ?? "");
        setMeta(data.meta ?? "Nao definida");
        setAltura(data.altura != null ? String(data.altura) : "");
        setPeso(data.peso != null ? String(data.peso) : "");
        setJaTreinou(data.ja_treinou ?? "Nunca treinou");
        setInitialForm({
          nome: data.nome ?? "",
          sobrenome: data.sobrenome ?? "",
          genero: data.genero ?? "Masculino",
          dataNascimento: data.dataNascimento ?? "",
          email: data.email ?? "",
          meta: data.meta ?? "Nao definida",
          altura: data.altura != null ? String(data.altura) : "",
          peso: data.peso != null ? String(data.peso) : "",
          jaTreinou: data.ja_treinou ?? "Nunca treinou",
        });
        setInitialAvatar(user?.avatar);
        updateUser({ nome: data.nome, email: data.email });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar perfil");
      } finally {
        setLoading(false);
      }
    };

    void loadPerfil();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  useEffect(() => {
    if (user) setAvatar(user.avatar);
  }, [user]);

  if (!user) return null;

  const fullName = `${nome} ${sobrenome}`.trim() || user.nome;

  const dirty =
    nome !== initialForm.nome ||
    sobrenome !== initialForm.sobrenome ||
    genero !== initialForm.genero ||
    dataNascimento !== initialForm.dataNascimento ||
    email !== initialForm.email ||
    meta !== initialForm.meta ||
    altura !== initialForm.altura ||
    peso !== initialForm.peso ||
    jaTreinou !== initialForm.jaTreinou ||
    avatar !== initialAvatar;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!token) return;

    setError("");
    setLoading(true);
    try {
      await apiRequest<{ success: boolean; message: string }>("/perfil", {
        method: "POST",
        token,
        body: JSON.stringify({
          nome: nome.trim(),
          sobrenome: sobrenome.trim(),
          genero,
          email: email.trim(),
          dataNascimento,
          meta: meta.trim() || "Nao definida",
          altura: altura ? Number(altura) : null,
          peso: peso ? Number(peso) : null,
          ja_treinou: jaTreinou,
        }),
      });

      updateUser({ nome: nome.trim() || user.nome, email: email.trim() || user.email, avatar });
      setInitialForm({
        nome,
        sobrenome,
        genero,
        dataNascimento,
        email,
        meta,
        altura,
        peso,
        jaTreinou,
      });
      setInitialAvatar(avatar);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  };

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setAvatar(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const onLogout = async () => {
    await logout();
    navigate({ to: "/" });
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-5xl px-6 py-12">
        <section className="relative overflow-hidden rounded-3xl bg-gradient-hero p-8 text-primary-foreground shadow-elegant md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />
          <div className="absolute -bottom-24 -left-10 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden />

          <div className="relative flex flex-col items-center gap-6 text-center sm:flex-row sm:items-center sm:text-left">
            <div className="relative">
              <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full border-4 border-white/30 bg-white/10 shadow-glow backdrop-blur">
                {avatar ? (
                  <img src={avatar} alt={fullName} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl font-bold">{getInitials(fullName)}</span>
                )}
              </div>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="absolute -bottom-1 -right-1 inline-flex h-10 w-10 items-center justify-center rounded-full border-2 border-white bg-foreground text-background shadow-md transition-smooth hover:scale-105"
                aria-label="Trocar avatar"
              >
                <Camera className="h-4 w-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
            </div>

            <div className="flex-1">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" /> Membro NutriNow
              </span>
              <h1 className="mt-3 font-display text-3xl font-bold md:text-4xl">{fullName}</h1>
              <p className="mt-1 text-primary-foreground/80">{email || user.email}</p>
            </div>

            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold backdrop-blur transition-smooth hover:bg-white/20"
            >
              <LogOut className="h-4 w-4" /> Sair
            </button>
          </div>
        </section>

        <section className="mt-6 rounded-3xl border border-border bg-card p-6 shadow-sm md:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="font-display text-xl font-bold">Informacoes da conta</h2>
              <p className="mt-1 text-sm text-muted-foreground">Atualize os mesmos dados usados no banco.</p>
            </div>
            {saved && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                <Check className="h-3.5 w-3.5" /> Salvo
              </span>
            )}
          </div>

          {error && <p className="mb-4 text-sm font-medium text-destructive">{error}</p>}

          <form onSubmit={onSubmit} className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Nome</span>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={nome}
                    onChange={(e) => setNome(e.target.value)}
                    className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                    required
                  />
                </div>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Sobrenome</span>
                <input
                  type="text"
                  value={sobrenome}
                  onChange={(e) => setSobrenome(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Genero</span>
                <select
                  value={genero}
                  onChange={(e) => setGenero(e.target.value as "Masculino" | "Feminino")}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                >
                  <option value="Masculino">Masculino</option>
                  <option value="Feminino">Feminino</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Data de nascimento</span>
                <input
                  type="date"
                  value={dataNascimento}
                  onChange={(e) => setDataNascimento(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </label>
            </div>

            <label className="block">
              <span className="mb-1.5 block text-sm font-medium">Email</span>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 pl-11 pr-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                  required
                />
              </div>
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Meta</span>
                <input
                  type="text"
                  value={meta}
                  onChange={(e) => setMeta(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Ja treinou?</span>
                <select
                  value={jaTreinou}
                  onChange={(e) => setJaTreinou(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="Nunca treinou">Nunca treinou</option>
                  <option value="Iniciante">Iniciante</option>
                  <option value="Intermediario">Intermediario</option>
                  <option value="Avancado">Avancado</option>
                </select>
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Altura (m)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={altura}
                  onChange={(e) => setAltura(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Peso (kg)</span>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={peso}
                  onChange={(e) => setPeso(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background py-3 px-4 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>

            {avatar && (
              <button
                type="button"
                onClick={() => setAvatar(undefined)}
                className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-smooth hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" /> Remover avatar
              </button>
            )}

            <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-smooth hover:border-destructive/40 hover:text-destructive sm:order-1"
              >
                <LogOut className="h-4 w-4" /> Sair da conta
              </button>
              <button
                type="submit"
                disabled={!dirty || loading}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-hero px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0 sm:order-2"
              >
                <Save className="h-4 w-4" /> {loading ? "Salvando..." : "Salvar alteracoes"}
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
