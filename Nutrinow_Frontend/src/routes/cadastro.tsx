import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { Mail, Lock, User, UserPlus, AlertCircle, Check } from "lucide-react";
import { AuthShell, Field, inputClass, primaryButtonClass } from "@/components/auth-shell";
import { AUTH_STORAGE_KEY, useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/cadastro")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem(AUTH_STORAGE_KEY)) {
      throw redirect({ to: "/" });
    }
  },
  component: CadastroPage,
  head: () => ({
    meta: [
      { title: "Criar conta no NutriNow" },
      { name: "description", content: "Crie sua conta NutriNow gratis e receba um plano personalizado." },
    ],
  }),
});

function CadastroPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [sobrenome, setSobrenome] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [genero, setGenero] = useState<"Masculino" | "Feminino">("Masculino");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [meta, setMeta] = useState("Nao definida");
  const [altura, setAltura] = useState("");
  const [peso, setPeso] = useState("");
  const [jaTreinou, setJaTreinou] = useState("Nunca treinou");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const senhaForte = senha.length >= 6;

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register({
        nome: nome.trim(),
        sobrenome: sobrenome.trim(),
        data_nascimento: dataNascimento,
        genero,
        email: email.trim(),
        senha,
        meta: meta.trim() || "Nao definida",
        altura: altura ? Number(altura) : undefined,
        peso: peso ? Number(peso) : undefined,
        ja_treinou: jaTreinou,
      });
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cadastrar");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      const { auth_url } = await apiRequest<{ auth_url: string }>("/auth/login", { method: "GET" });
      if (auth_url) window.location.href = auth_url;
    } catch (err) {
      setError("Erro ao conectar com o Google");
    }
  };

  return (
    <AuthShell
      title="Crie sua conta"
      subtitle="Preencha seus dados para comecar com planos personalizados."
      footer={
        <p>
          Ja tem conta?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">
            Fazer login
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Nome" icon={<User className="h-4 w-4" />}>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Sobrenome" icon={<User className="h-4 w-4" />}>
            <input
              type="text"
              value={sobrenome}
              onChange={(e) => setSobrenome(e.target.value)}
              placeholder="Sobrenome"
              className={inputClass}
              required
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Data de nascimento">
            <input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className={inputClass} required />
          </Field>
          <Field label="Genero">
            <select value={genero} onChange={(e) => setGenero(e.target.value as "Masculino" | "Feminino")} className={inputClass} required>
              <option value="Masculino">Masculino</option>
              <option value="Feminino">Feminino</option>
            </select>
          </Field>
        </div>

        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className={inputClass}
            required
          />
        </Field>
        <Field
          label="Senha"
          icon={<Lock className="h-4 w-4" />}
          hint={
            <span className={`inline-flex items-center gap-1 ${senhaForte ? "text-primary" : ""}`}>
              <Check className="h-3 w-3" /> Minimo de 6 caracteres
            </span>
          }
        >
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha"
            className={inputClass}
            required
          />
        </Field>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Meta">
            <input
              type="text"
              value={meta}
              onChange={(e) => setMeta(e.target.value)}
              placeholder="Meta"
              className={inputClass}
            />
          </Field>
          <Field label="Ja treinou?">
            <select value={jaTreinou} onChange={(e) => setJaTreinou(e.target.value)} className={inputClass}>
              <option value="Nunca treinou">Nunca treinou</option>
              <option value="Iniciante">Iniciante</option>
              <option value="Intermediario">Intermediario</option>
              <option value="Avancado">Avancado</option>
            </select>
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Altura (m)">
            <input type="number" step="0.01" min="0" value={altura} onChange={(e) => setAltura(e.target.value)} placeholder="1.70" className={inputClass} />
          </Field>
          <Field label="Peso (kg)">
            <input type="number" step="0.1" min="0" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="68.5" className={inputClass} />
          </Field>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          <UserPlus className="h-4 w-4" /> {loading ? "Criando conta..." : "Criar conta gratis"}
        </button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-card px-2 text-muted-foreground">Ou cadastre-se com</span>
          </div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-smooth hover:bg-secondary"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
            <path d="M1 1h22v22H1z" fill="none" />
          </svg>
          Google
        </button>
      </form>
    </AuthShell>
  );
}
