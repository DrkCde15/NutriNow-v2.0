import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { Mail, Lock, User, UserPlus, AlertCircle, Check } from "lucide-react";
import { AuthShell, Field, inputClass, primaryButtonClass } from "@/components/auth-shell";
import { AUTH_STORAGE_KEY, useAuth } from "@/lib/auth";

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
      </form>
    </AuthShell>
  );
}
