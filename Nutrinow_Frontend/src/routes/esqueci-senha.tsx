import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Mail, Send, ArrowLeft, CheckCircle2 } from "lucide-react";
import { AuthShell, Field, inputClass, primaryButtonClass } from "@/components/auth-shell";
import { apiRequest } from "@/lib/api";

export const Route = createFileRoute("/esqueci-senha")({
  component: EsqueciSenhaPage,
  head: () => ({
    meta: [
      { title: "Recuperar senha â€” NutriNow" },
      { name: "description", content: "Recupere o acesso a sua conta NutriNow." },
    ],
  }),
});

function EsqueciSenhaPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await apiRequest("/esqueci-senha", {
        method: "POST",
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao solicitar recuperacao");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Recuperar senha"
      subtitle="Enviaremos um link para voce definir uma nova senha."
      footer={
        <Link to="/login" className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
          <ArrowLeft className="h-4 w-4" /> Voltar para o login
        </Link>
      }
    >
      {sent ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
          <h2 className="mt-4 font-display text-xl font-semibold">Link enviado!</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Se o email <strong>{email}</strong> estiver cadastrado, voce recebera um link em instantes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-5">
          <Field label="Email cadastrado" icon={<Mail className="h-4 w-4" />}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className={inputClass}
              required
            />
          </Field>
          <button type="submit" disabled={loading} className={primaryButtonClass}>
            <Send className="h-4 w-4" /> {loading ? "Enviando..." : "Enviar link de recuperacao"}
          </button>
          {error && <p className="text-sm font-medium text-destructive">{error}</p>}
        </form>
      )}
    </AuthShell>
  );
}
