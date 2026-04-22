import { useEffect, useRef, useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Send, Sparkles, ImagePlus, Leaf } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { apiRequest } from "@/lib/api";
import { CHAT_SESSION_STORAGE_KEY, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/chat")({
  component: ChatPage,
  head: () => ({
    meta: [
      { title: "Chat NutriAI - NutriNow" },
      { name: "description", content: "Converse com a NutriAI sobre nutricao e treinos." },
    ],
  }),
});

interface Message {
  id: string;
  text: string;
  isUser: boolean;
  timestamp: Date;
}

interface ChatHistoryItem {
  role: "user" | "assistant";
  content: string;
  timestamp?: string;
}

interface ChatResponse {
  success: boolean;
  session_id: string;
  response: string;
}

const suggestions = [
  "Sugira um cafe da manha rapido",
  "Treino de 20 min em casa",
  "Quantas calorias tem 100g de arroz?",
  "Receita saudavel com frango",
];

function ChatPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const existing = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    if (existing) {
      setSessionId(existing);
      return;
    }
    const created = crypto.randomUUID();
    localStorage.setItem(CHAT_SESSION_STORAGE_KEY, created);
    setSessionId(created);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!token || !sessionId) return;
      setError("");

      try {
        const data = await apiRequest<{ success: boolean; history: ChatHistoryItem[] }>(
          `/chat_history?session_id=${sessionId}`,
          { method: "GET", token, sessionId },
        );

        if (!data.history?.length) {
          setMessages([
            {
              id: "welcome",
              text: "Ola. Sou a NutriAI. Como posso ajudar com sua alimentacao e treino hoje?",
              isUser: false,
              timestamp: new Date(),
            },
          ]);
          return;
        }

        const mapped = data.history.map((m, idx) => ({
          id: `${idx}-${m.timestamp ?? Date.now()}`,
          text: m.content,
          isUser: m.role === "user",
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        }));
        setMessages(mapped);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar historico");
      }
    };

    loadHistory();
  }, [token, sessionId]);

  const sendText = async (text: string) => {
    if (!text.trim() || !token || !sessionId) return;
    setError("");

    const userMessage: Message = {
      id: crypto.randomUUID(),
      text: text.trim(),
      isUser: true,
      timestamp: new Date(),
    };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setTyping(true);

    try {
      const response = await apiRequest<ChatResponse>("/chat", {
        method: "POST",
        token,
        sessionId,
        body: JSON.stringify({ message: text.trim(), session_id: sessionId }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: response.response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar mensagem");
    } finally {
      setTyping(false);
    }
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendText(input);
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !sessionId) return;
    e.target.value = "";

    setMessages((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        text: `Imagem enviada: ${file.name}`,
        isUser: true,
        timestamp: new Date(),
      },
    ]);

    setTyping(true);
    setError("");

    try {
      const form = new FormData();
      form.append("file", file);
      form.append("message_type", "human");
      form.append("session_id", sessionId);

      const response = await apiRequest<ChatResponse>("/analyze_image", {
        method: "POST",
        token,
        sessionId,
        body: form,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          text: response.response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar imagem");
    } finally {
      setTyping(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <SiteHeader />

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 py-6 md:px-6 md:py-10">
        <div className="flex flex-1 flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-elegant">
          <div className="flex items-center justify-between border-b border-border bg-gradient-soft px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow">
                <Leaf className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">NutriAI</p>
                <h1 className="font-display text-lg font-bold leading-tight">Sua nutricionista virtual</h1>
              </div>
            </div>
            <span className="hidden items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary sm:inline-flex">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Online
            </span>
          </div>

          <div
            ref={scrollRef}
            className="flex-1 space-y-4 overflow-y-auto bg-gradient-soft/40 p-4 md:p-6"
            style={{ minHeight: "400px", maxHeight: "60vh" }}
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} userInitial={user.nome[0]} />
            ))}
            {typing && (
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground">
                  <Sparkles className="h-4 w-4" />
                </span>
                <div className="rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
                    <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {messages.length <= 1 && (
            <div className="border-t border-border px-4 pt-3 md:px-6">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Sugestoes</p>
              <div className="flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void sendText(s)}
                    className="rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground transition-smooth hover:border-primary/40 hover:bg-secondary"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <p className="px-4 pb-2 text-sm font-medium text-destructive md:px-6">{error}</p>}

          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border bg-card p-4 md:p-5">
            <label className="cursor-pointer rounded-xl border border-border bg-card p-3 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground">
              <ImagePlus className="h-5 w-5" />
              <input type="file" accept="image/*" className="hidden" onChange={onFile} />
            </label>
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pergunte algo a NutriAI..."
              className="flex-1 rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="submit"
              disabled={!input.trim() || typing}
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
              aria-label="Enviar"
            >
              <Send className="h-5 w-5" />
            </button>
          </form>
        </div>
      </main>
    </div>
  );
}

function MessageBubble({ message, userInitial }: { message: Message; userInitial: string }) {
  const time = message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (message.isUser) {
    return (
      <div className="flex items-start justify-end gap-3">
        <div className="max-w-[80%] rounded-2xl rounded-tr-md bg-gradient-hero px-4 py-3 text-primary-foreground shadow-sm">
          <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.text}</p>
          <span className="mt-1.5 block text-right text-[10px] text-primary-foreground/70">{time}</span>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-foreground font-semibold text-background">
          {userInitial}
        </span>
      </div>
    );
  }

  const html = message.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br />");

  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-hero text-primary-foreground shadow-glow">
        <Sparkles className="h-4 w-4" />
      </span>
      <div className="max-w-[80%] rounded-2xl rounded-tl-md bg-card px-4 py-3 shadow-sm">
        <div className="text-sm leading-relaxed text-foreground" dangerouslySetInnerHTML={{ __html: html }} />
        <span className="mt-1.5 block text-[10px] text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}
