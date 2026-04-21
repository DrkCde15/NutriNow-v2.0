import { useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate, redirect } from "@tanstack/react-router";
import { Mail, Lock, LogIn, AlertCircle } from "lucide-react";
import { AuthShell, Field, inputClass, primaryButtonClass } from "@/components/auth-shell";
import { AUTH_STORAGE_KEY, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/login")({
  beforeLoad: () => {
    if (typeof window !== "undefined" && localStorage.getItem(AUTH_STORAGE_KEY)) {
      throw redirect({ to: "/" });
    }
  },
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Entrar — NutriNow" },
      { name: "description", content: "Acesse sua conta NutriNow e continue sua jornada saudável." },
    ],
  }),
});

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, senha);
      navigate({ to: "/" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao entrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Bem-vindo de volta"
      subtitle="Entre na sua conta para continuar sua jornada."
      footer={
        <p>
          Ainda não tem conta?{" "}
          <Link to="/cadastro" className="font-semibold text-primary hover:underline">
            Cadastre-se grátis
          </Link>
        </p>
      }
    >
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="Email" icon={<Mail className="h-4 w-4" />}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className={inputClass}
            required
          />
        </Field>
        <Field label="Senha" icon={<Lock className="h-4 w-4" />}>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="••••••••"
            className={inputClass}
            required
          />
        </Field>

        <div className="flex justify-end">
          <Link to="/esqueci-senha" className="text-sm font-medium text-primary hover:underline">
            Esqueci minha senha
          </Link>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <button type="submit" disabled={loading} className={primaryButtonClass}>
          <LogIn className="h-4 w-4" /> {loading ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </AuthShell>
  );
}

// Redirect away if already authenticated — mock check via localStorage
