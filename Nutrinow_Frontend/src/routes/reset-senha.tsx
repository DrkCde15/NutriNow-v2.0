import { useMemo, useState, type FormEvent } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Lock, KeyRound, CheckCircle2 } from "lucide-react";
import { AuthShell, Field, inputClass, primaryButtonClass } from "@/components/auth-shell";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/reset-senha")({
  component: ResetSenhaPage,
  head: () => ({
    meta: [
      { title: "Redefinir senha â€” NutriNow" },
      { name: "description", content: "Defina uma nova senha para sua conta NutriNow." },
    ],
  }),
});

function ResetSenhaPage() {
  const navigate = useNavigate();
  const tokenFromUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("token") ?? "";
  }, []);

  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");

    if (!tokenFromUrl) return setError("Token invalido ou ausente.");
    if (senha.length < 6) return setError("Senha deve ter ao menos 6 caracteres");
    if (senha !== confirmar) return setError("As senhas nao coincidem");

    setLoading(true);
    try {
      await apiRequest("/redefinir-senha", {
        method: "POST",
        body: JSON.stringify({ token: tokenFromUrl, nova_senha: senha }),
      });

      setDone(true);
      setTimeout(() => navigate({ to: "/login" }), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao redefinir senha");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Defina sua nova senha"
      subtitle="Escolha uma senha forte que voce consiga lembrar."
      footer={
        <Link to="/login" className="font-medium text-primary hover:underline">
          Voltar para o login
        </Link>
      }
    >
      {done ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-xl font-semibold">Senha atualizada!</h2>
          <p className="mt-2 text-sm text-muted-foreground">Redirecionando para o login...</p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Nova senha" icon={<Lock className="h-4 w-4" />}>
            <input
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="********"
              className={inputClass}
              required
            />
          </Field>
          <Field label="Confirmar nova senha" icon={<Lock className="h-4 w-4" />}>
            <input
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              placeholder="********"
              className={inputClass}
              required
            />
          </Field>

          {error && (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <button type="submit" disabled={loading} className={primaryButtonClass}>
            <KeyRound className="h-4 w-4" /> {loading ? "Atualizando..." : "Atualizar senha"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
