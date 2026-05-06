import { useState, type FormEvent } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, MessageCircle, Send, Star } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/feedbacks")({
  component: FeedbacksPage,
  head: () => ({
    meta: [
      { title: "Feedbacks - NutriNow" },
      { name: "description", content: "Envie seu feedback e ajude o NutriNow a melhorar." },
    ],
  }),
});

function FeedbacksPage() {
  const { user, token } = useAuth();
  const [rating, setRating] = useState<number>(0);
  const [message, setMessage] = useState("");
  const [name, setName] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!rating || !message.trim()) return;

    setSubmitting(true);
    setError("");

    try {
      await apiRequest<{ success: boolean; message: string }>("/feedbacks", {
        method: "POST",
        token,
        body: JSON.stringify({
          rating,
          message,
          name: name.trim() || user?.nome || "",
        }),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nao foi possivel enviar o feedback");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-6 py-12 md:py-16">
        <Link
          to="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground transition-smooth hover:bg-secondary"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para a pagina inicial
        </Link>

        <section className="mt-6 overflow-hidden rounded-[2rem] border border-border bg-card shadow-elegant">
          <div className="bg-gradient-hero px-6 py-8 text-primary-foreground sm:px-8">
            <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-white/15">
              <MessageCircle className="h-5 w-5" />
            </div>
            <h1 className="mt-4 font-display text-3xl font-bold md:text-4xl">Feedbacks do NutriNow</h1>
            <p className="mt-2 max-w-xl text-sm text-primary-foreground/90 sm:text-base">
              Sua opiniao ajuda a gente a evoluir mais rapido. Conta pra gente o que voce gostou e o que podemos melhorar.
            </p>
          </div>

          <div className="px-6 py-8 sm:px-8">
            {submitted ? (
              <div className="rounded-2xl border border-primary/30 bg-primary/5 p-6 text-center">
                <p className="font-display text-2xl font-semibold">Obrigado pelo seu feedback!</p>
                <p className="mt-2 text-sm text-muted-foreground">
                  Sua mensagem foi registrada e vai nos ajudar a melhorar o NutriNow.
                </p>
                <button
                  onClick={() => {
                    setSubmitted(false);
                    setMessage("");
                    setName("");
                    setRating(0);
                    setError("");
                  }}
                  className="mt-5 rounded-full border border-border px-4 py-2 text-sm font-medium transition-smooth hover:bg-secondary"
                >
                  Enviar outro feedback
                </button>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-6">
                <div>
                  <p className="text-sm font-semibold">Como voce avalia sua experiencia?</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[1, 2, 3, 4, 5].map((value) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setRating(value)}
                        className={`inline-flex items-center gap-1 rounded-full border px-4 py-2 text-sm font-medium transition-smooth ${
                          rating >= value
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground hover:text-foreground"
                        }`}
                        aria-label={`Nota ${value}`}
                      >
                        <Star className="h-4 w-4" /> {value}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Nome (opcional)</span>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Mensagem</span>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Escreva seu feedback aqui..."
                    rows={5}
                    required
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
                {error && <p className="text-sm font-medium text-destructive">{error}</p>}

                <button
                  type="submit"
                  disabled={!rating || !message.trim() || submitting}
                  className="inline-flex items-center gap-2 rounded-full bg-gradient-hero px-6 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className="h-4 w-4" /> {submitting ? "Enviando..." : "Enviar feedback"}
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
