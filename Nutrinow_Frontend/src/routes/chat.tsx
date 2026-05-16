import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
  CalendarDays,
  Dumbbell,
  ImagePlus,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Search,
  Send,
  Trash2,
  User,
  X,
} from "lucide-react";
import { apiRequest } from "@/lib/api";
import { CHAT_SESSION_STORAGE_KEY, useAuth } from "@/lib/auth";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";

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

interface ChatSession {
  session_id: string;
  title: string;
  preview?: string;
  created_at?: string;
  updated_at?: string;
  message_count: number;
}

interface ChatResponse {
  success: boolean;
  session_id: string;
  response: string;
}

const CHAT_SESSIONS_CACHE_KEY = "nutrinow_chat_sessions_cache";

const suggestions = [
  "Sugira um cafe da manha rapido",
  "Treino de 20 min em casa",
  "Quantas calorias tem 100g de arroz?",
  "Receita saudavel com frango",
];

const genericChatTokens = new Set([
  "oi",
  "ola",
  "ok",
  "okay",
  "sim",
  "nao",
  "valeu",
  "obrigado",
  "obrigada",
  "bom",
  "boa",
  "dia",
  "tarde",
  "noite",
  "tudo",
  "bem",
]);

function createSessionId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function welcomeMessage(): Message {
  return {
    id: "welcome",
    text: "Ola. Sou a NutriAI. Como posso ajudar com sua alimentacao e treino hoje?",
    isUser: false,
    timestamp: new Date(),
  };
}

function normalizeText(value = "") {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\w\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isGenericMessage(value = "") {
  const tokens = normalizeText(value).split(" ").filter(Boolean);
  return (
    tokens.length > 0 && tokens.length <= 5 && tokens.every((token) => genericChatTokens.has(token))
  );
}

function formatMessageTime(value: Date) {
  return value.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatSessionTime(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function loadCachedSessions() {
  if (typeof window === "undefined") return [];
  try {
    const cached = localStorage.getItem(CHAT_SESSIONS_CACHE_KEY);
    if (!cached) return [];
    const parsed = JSON.parse(cached) as ChatSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function cacheSessions(sessions: ChatSession[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(CHAT_SESSIONS_CACHE_KEY, JSON.stringify(sessions));
}

function mapHistoryItem(item: ChatHistoryItem, index: number): Message {
  const timestamp = item.timestamp ? new Date(item.timestamp) : new Date();
  return {
    id: `${index}-${item.timestamp ?? Date.now()}`,
    text: item.content,
    isUser: item.role === "user",
    timestamp: Number.isNaN(timestamp.getTime()) ? new Date() : timestamp,
  };
}

function ChatPage() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [error, setError] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [historySearch, setHistorySearch] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const persistSession = useCallback((nextSessionId: string) => {
    setSessionId(nextSessionId);
    if (typeof window !== "undefined") {
      localStorage.setItem(CHAT_SESSION_STORAGE_KEY, nextSessionId);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    if (!token) return;
    try {
      const data = await apiRequest<{ success: boolean; sessions: ChatSession[] }>(
        "/chat_sessions",
        {
          method: "GET",
          token,
        },
      );
      const nextSessions = data.sessions ?? [];
      setSessions(nextSessions);
      cacheSessions(nextSessions);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar historico");
    }
  }, [token]);

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setSessions(loadCachedSessions());

    const existing = localStorage.getItem(CHAT_SESSION_STORAGE_KEY);
    persistSession(existing || createSessionId());
  }, [persistSession]);

  useEffect(() => {
    void refreshSessions();
  }, [refreshSessions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    const loadHistory = async () => {
      if (!token || !sessionId) return;
      setError("");

      try {
        const data = await apiRequest<{ success: boolean; history: ChatHistoryItem[] }>(
          `/chat_history?session_id=${encodeURIComponent(sessionId)}`,
          { method: "GET", token, sessionId },
        );

        const history = data.history ?? [];
        setMessages(history.length ? history.map(mapHistoryItem) : [welcomeMessage()]);
      } catch (err) {
        setMessages([welcomeMessage()]);
        setError(err instanceof Error ? err.message : "Erro ao carregar historico");
      }
    };

    void loadHistory();
  }, [token, sessionId]);

  const filteredSessions = useMemo(() => {
    const query = normalizeText(historySearch);
    if (!query) return sessions;
    return sessions.filter((session) => {
      const haystack = normalizeText(`${session.title} ${session.preview ?? ""}`);
      return haystack.includes(query);
    });
  }, [historySearch, sessions]);

  const hasOnlyWelcome = messages.length <= 1 && messages.every((message) => !message.isUser);

  const startNewChat = () => {
    persistSession(createSessionId());
    setMessages([welcomeMessage()]);
    setInput("");
    setError("");
    setSidebarOpen(false);
  };

  const activateSession = (nextSessionId: string) => {
    if (nextSessionId === sessionId) {
      setSidebarOpen(false);
      return;
    }
    persistSession(nextSessionId);
    setInput("");
    setError("");
    setSidebarOpen(false);
  };

  const removeSession = async (targetSessionId: string) => {
    if (!token) return;
    setError("");

    try {
      await apiRequest<{ success: boolean }>(
        `/chat_sessions/${encodeURIComponent(targetSessionId)}`,
        {
          method: "DELETE",
          token,
        },
      );

      const nextSessions = sessions.filter((session) => session.session_id !== targetSessionId);
      setSessions(nextSessions);
      cacheSessions(nextSessions);

      if (targetSessionId === sessionId) {
        const nextSession = nextSessions[0]?.session_id || createSessionId();
        persistSession(nextSession);
        if (!nextSessions[0]) setMessages([welcomeMessage()]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir conversa");
    }
  };

  const addOptimisticSession = (messageText: string, assistantText?: string) => {
    const title = isGenericMessage(messageText) ? "Nova conversa" : messageText;
    const preview = assistantText || messageText;
    const now = new Date().toISOString();

    setSessions((prev) => {
      const nextSession: ChatSession = {
        session_id: sessionId,
        title,
        preview,
        created_at: now,
        updated_at: now,
        message_count: assistantText ? 2 : 1,
      };

      const next = [nextSession, ...prev.filter((session) => session.session_id !== sessionId)];
      cacheSessions(next);
      return next;
    });
  };

  const sendText = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || !token || !sessionId || typing) return;
    setError("");

    const userMessage: Message = {
      id: createSessionId(),
      text: trimmed,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages((prev) => (hasOnlyWelcome ? [userMessage] : [...prev, userMessage]));
    setInput("");
    setTyping(true);
    addOptimisticSession(trimmed);

    try {
      const response = await apiRequest<ChatResponse>("/chat", {
        method: "POST",
        token,
        sessionId,
        body: JSON.stringify({ message: trimmed, session_id: sessionId }),
      });

      setMessages((prev) => [
        ...prev,
        {
          id: createSessionId(),
          text: response.response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      addOptimisticSession(trimmed, response.response);
      void refreshSessions();
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

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !token || !sessionId || typing) return;
    e.target.value = "";

    const imageLabel = `Imagem enviada: ${file.name}`;
    setMessages((prev) => [
      ...(hasOnlyWelcome ? [] : prev),
      {
        id: createSessionId(),
        text: imageLabel,
        isUser: true,
        timestamp: new Date(),
      },
    ]);
    addOptimisticSession(imageLabel);

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
          id: createSessionId(),
          text: response.response,
          isUser: false,
          timestamp: new Date(),
        },
      ]);
      addOptimisticSession(imageLabel, response.response);
      void refreshSessions();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao analisar imagem");
    } finally {
      setTyping(false);
    }
  };

  if (!user) return null;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#f7fffb] text-[#06241e]">
      <ChatTopBar
        userName={user.nome}
        onLogout={logout}
        onOpenSidebar={() => setSidebarOpen(true)}
      />

      <main className="flex min-h-0 flex-1 overflow-hidden">
        {sidebarOpen && (
          <button
            type="button"
            className="fixed inset-0 z-40 bg-foreground/20 backdrop-blur-sm lg:hidden"
            aria-label="Fechar historico"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <aside
          className={cn(
            "w-80 shrink-0 flex-col border-r border-emerald-100 bg-white/85 backdrop-blur-xl",
            sidebarOpen
              ? "fixed inset-y-0 left-0 z-50 flex shadow-2xl lg:static lg:z-auto lg:shadow-none"
              : "hidden lg:flex",
          )}
        >
          <div className="flex items-center justify-between px-5 pb-4 pt-5 lg:hidden">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                Historico
              </p>
              <h2 className="font-display text-base font-bold">Conversas</h2>
            </div>
            <button
              type="button"
              onClick={() => setSidebarOpen(false)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-100 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground"
              aria-label="Fechar historico"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 px-4 py-5">
            <button
              type="button"
              onClick={startNewChat}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-gradient-hero px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-smooth hover:-translate-y-0.5 hover:shadow-glow"
            >
              <Plus className="h-4 w-4" />
              Novo chat
            </button>

            <label className="flex items-center gap-2 rounded-lg border border-emerald-100 bg-white px-3 py-2.5 text-muted-foreground transition-smooth focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
              <Search className="h-4 w-4" />
              <input
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                placeholder="Buscar chats"
                className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-5">
            <p className="mb-3 px-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Recentes
            </p>
            {filteredSessions.length ? (
              <div className="space-y-2">
                {filteredSessions.map((session) => (
                  <HistoryRow
                    key={session.session_id}
                    session={session}
                    active={session.session_id === sessionId}
                    onOpen={() => activateSession(session.session_id)}
                    onDelete={() => void removeSession(session.session_id)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-emerald-100 bg-white/70 px-4 py-6 text-center">
                <MessageSquare className="mx-auto mb-2 h-5 w-5 text-muted-foreground" />
                <p className="text-sm font-semibold text-foreground">Sem conversas</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  As consultas salvas aparecem aqui.
                </p>
              </div>
            )}
          </div>
        </aside>

        <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <div
            ref={scrollRef}
            className="min-h-0 flex-1 space-y-7 overflow-y-auto bg-[radial-gradient(circle_at_30%_0%,rgba(52,211,153,0.12),transparent_34%),linear-gradient(180deg,#f7fffb_0%,#f2fbf8_100%)] px-5 py-8 md:px-10"
          >
            {messages.map((m) => (
              <MessageBubble key={m.id} message={m} userInitial={user.nome?.[0] || "U"} />
            ))}
            {typing && <TypingBubble />}
          </div>

          {hasOnlyWelcome && (
            <div className="border-t border-emerald-100 bg-white/80 px-5 pt-3 md:px-10">
              <div className="mx-auto max-w-5xl">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Sugestoes
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => void sendText(s)}
                      className="rounded-full border border-emerald-100 bg-white px-3 py-1.5 text-xs font-medium text-foreground transition-smooth hover:border-primary/40 hover:bg-secondary"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <p className="border-t border-emerald-100 bg-white/80 px-5 pb-2 pt-3 text-sm font-medium text-destructive md:px-10">
              {error}
            </p>
          )}

          <form
            onSubmit={onSubmit}
            className="border-t border-emerald-100 bg-white/85 px-5 py-4 backdrop-blur-xl md:px-10"
          >
            <div className="mx-auto flex max-w-5xl items-center gap-2">
              <label
                className={cn(
                  "inline-flex h-12 w-12 cursor-pointer items-center justify-center rounded-full border border-emerald-100 bg-white text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground",
                  typing && "pointer-events-none opacity-60",
                )}
                aria-label="Enviar imagem"
              >
                <ImagePlus className="h-5 w-5" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={onFile}
                  disabled={typing}
                />
              </label>
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Pergunte algo a NutriAI..."
                className="min-w-0 flex-1 rounded-full border border-emerald-100 bg-white px-5 py-3 text-sm outline-none transition-smooth focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              <button
                type="submit"
                disabled={!input.trim() || typing}
                className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-gradient-hero text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 hover:shadow-glow disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:translate-y-0"
                aria-label="Enviar"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}

function ChatTopBar({
  userName,
  onLogout,
  onOpenSidebar,
}: {
  userName: string;
  onLogout: () => Promise<void>;
  onOpenSidebar: () => void;
}) {
  const firstName = userName.split(" ")[0] || "Perfil";

  return (
    <header className="flex h-20 shrink-0 items-center justify-between border-b border-emerald-100 bg-white/95 px-5 backdrop-blur-xl md:px-8">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onOpenSidebar}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-100 text-muted-foreground transition-smooth hover:border-primary/40 hover:text-foreground lg:hidden"
          aria-label="Abrir historico"
        >
          <Menu className="h-5 w-5" />
        </button>
        <Link to="/dashboard" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-emerald-100">
            <img src={logo} alt="NutriNow" className="h-full w-full object-cover" />
          </span>
          <span className="font-display text-xl font-bold tracking-tight">
            Nutri<span className="text-primary">Now</span>
          </span>
        </Link>
      </div>

      <nav className="hidden items-center gap-1 md:flex">
        <TopNavLink to="/chat" active icon={<MessageSquare className="h-4 w-4" />} label="Chat" />
        <TopNavLink
          to="/dashboard"
          icon={<LayoutDashboard className="h-4 w-4" />}
          label="Dashboard"
        />
        <TopNavLink to="/planos" icon={<Dumbbell className="h-4 w-4" />} label="Planos" />
        <TopNavLink
          to="/calendario"
          icon={<CalendarDays className="h-4 w-4" />}
          label="Calendario"
        />
        <TopNavLink to="/perfil" icon={<User className="h-4 w-4" />} label={firstName} />
        <button
          type="button"
          onClick={() => void onLogout()}
          className="ml-2 inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-muted-foreground transition-smooth hover:bg-secondary hover:text-foreground"
        >
          <LogOut className="h-4 w-4" />
          Sair
        </button>
      </nav>
    </header>
  );
}

function TopNavLink({
  to,
  icon,
  label,
  active = false,
}: {
  to: "/chat" | "/dashboard" | "/planos" | "/calendario" | "/perfil";
  icon: ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold transition-smooth",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-secondary hover:text-foreground",
      )}
    >
      {icon}
      {label}
    </Link>
  );
}

function HistoryRow({
  session,
  active,
  onOpen,
  onDelete,
}: {
  session: ChatSession;
  active: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={cn(
        "group flex items-start gap-2 rounded-xl border border-transparent p-3 transition-smooth",
        active
          ? "border-primary/25 bg-emerald-50 text-foreground"
          : "hover:border-emerald-100 hover:bg-white",
      )}
    >
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
        <span className="line-clamp-1 text-sm font-semibold text-foreground">
          {session.title || "Nova conversa"}
        </span>
        {session.preview && (
          <span className="mt-1 line-clamp-2 block text-xs leading-relaxed text-muted-foreground">
            {session.preview}
          </span>
        )}
        <span className="mt-2 block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {formatSessionTime(session.updated_at)}{" "}
          {session.message_count ? `- ${session.message_count} msgs` : ""}
        </span>
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground opacity-100 transition-smooth hover:bg-destructive/10 hover:text-destructive md:opacity-0 md:group-hover:opacity-100"
        aria-label="Excluir conversa"
      >
        <Trash2 className="h-4 w-4" />
      </button>
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="mx-auto flex w-full max-w-5xl items-start gap-3">
      <NutriAiAvatar />
      <div className="rounded-2xl rounded-tl-md border border-emerald-100 bg-white px-4 py-3 shadow-sm">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:150ms]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, userInitial }: { message: Message; userInitial: string }) {
  const time = formatMessageTime(message.timestamp);

  if (message.isUser) {
    return (
      <div className="mx-auto flex w-full max-w-5xl items-start justify-end gap-3">
        <div className="max-w-[72%] rounded-2xl rounded-tr-md bg-gradient-hero px-4 py-3 text-primary-foreground shadow-sm">
          <MessageContent text={message.text} inverse />
          <span className="mt-1.5 block text-right text-[10px] text-primary-foreground/70">
            {time}
          </span>
        </div>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-foreground font-semibold text-background">
          {userInitial.toUpperCase()}
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-5xl items-start gap-3">
      <NutriAiAvatar />
      <div className="min-w-0 max-w-3xl rounded-2xl rounded-tl-md border border-emerald-100 bg-white px-4 py-3 shadow-sm">
        <MessageContent text={message.text} />
        <span className="mt-2 block text-[10px] text-muted-foreground">{time}</span>
      </div>
    </div>
  );
}

function NutriAiAvatar() {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-emerald-100">
      <img src={logo} alt="NutriAI" className="h-full w-full object-cover" />
    </span>
  );
}

type MessageBlock =
  | { type: "spacer"; id: string }
  | { type: "divider"; id: string }
  | { type: "heading"; id: string; level: number; content: string }
  | { type: "quote"; id: string; lines: string[] }
  | { type: "list"; id: string; ordered: boolean; items: string[] }
  | { type: "table"; id: string; rows: string[][] }
  | { type: "paragraph"; id: string; content: string };

function MessageContent({ text, inverse = false }: { text: string; inverse?: boolean }) {
  const blocks = parseMessageBlocks(text);

  return (
    <div
      className={cn(
        "space-y-3 text-sm leading-7",
        inverse ? "text-primary-foreground" : "text-foreground",
      )}
    >
      {blocks.map((block) => (
        <MessageBlockView key={block.id} block={block} inverse={inverse} />
      ))}
    </div>
  );
}

function parseMessageBlocks(text: string): MessageBlock[] {
  const lines = text.split(/\r?\n/);
  const blocks: MessageBlock[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];
    const trimmed = line.trim();
    const id = `${index}-${trimmed}`;

    if (!trimmed) {
      blocks.push({ type: "spacer", id });
      index += 1;
      continue;
    }

    if (/^-{3,}$/.test(trimmed)) {
      blocks.push({ type: "divider", id });
      index += 1;
      continue;
    }

    const heading = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (heading) {
      blocks.push({
        type: "heading",
        id,
        level: heading[1].length,
        content: heading[2],
      });
      index += 1;
      continue;
    }

    if (isTableRow(trimmed)) {
      const rows: string[][] = [];
      while (index < lines.length && isTableRow(lines[index].trim())) {
        const cells = splitTableRow(lines[index]);
        if (!isTableSeparatorRow(cells)) rows.push(cells);
        index += 1;
      }

      if (rows.length > 1 && rows[0].length > 1) {
        blocks.push({ type: "table", id, rows });
        continue;
      }

      rows.flat().forEach((content, rowIndex) => {
        blocks.push({ type: "paragraph", id: `${id}-table-${rowIndex}`, content });
      });
      continue;
    }

    if (trimmed.startsWith(">")) {
      const quoteLines: string[] = [];
      while (index < lines.length && lines[index].trim().startsWith(">")) {
        quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));
        index += 1;
      }
      blocks.push({ type: "quote", id, lines: quoteLines });
      continue;
    }

    if (/^[-*]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed)) {
      const ordered = /^\d+\.\s+/.test(trimmed);
      const items: string[] = [];

      while (index < lines.length) {
        const itemLine = lines[index].trim();
        const matchesCurrentList = ordered ? /^\d+\.\s+/.test(itemLine) : /^[-*]\s+/.test(itemLine);
        if (!matchesCurrentList) break;
        items.push(itemLine.replace(ordered ? /^\d+\.\s+/ : /^[-*]\s+/, ""));
        index += 1;
      }

      blocks.push({ type: "list", id, ordered, items });
      continue;
    }

    blocks.push({ type: "paragraph", id, content: line });
    index += 1;
  }

  return blocks;
}

function MessageBlockView({ block, inverse }: { block: MessageBlock; inverse: boolean }) {
  switch (block.type) {
    case "spacer":
      return <div className="h-1" />;
    case "divider":
      return (
        <div className={cn("my-4 h-px", inverse ? "bg-primary-foreground/25" : "bg-border")} />
      );
    case "heading":
      return (
        <h3
          className={cn(
            "pt-1 font-display font-bold leading-snug",
            block.level <= 2 ? "text-base md:text-lg" : "text-sm md:text-base",
          )}
        >
          {renderInlineMarkdown(block.content, inverse)}
        </h3>
      );
    case "quote":
      return (
        <blockquote
          className={cn(
            "space-y-1 border-l-2 pl-3 italic",
            inverse ? "border-primary-foreground/50" : "border-primary/40 text-muted-foreground",
          )}
        >
          {block.lines.map((line, index) => (
            <p key={`${block.id}-quote-${index}`}>{renderInlineMarkdown(line, inverse)}</p>
          ))}
        </blockquote>
      );
    case "list": {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag
          className={cn(
            "space-y-1 pl-5",
            block.ordered ? "list-decimal" : "list-disc",
            inverse ? "" : "marker:text-primary",
          )}
        >
          {block.items.map((item, index) => (
            <li key={`${block.id}-item-${index}`}>{renderInlineMarkdown(item, inverse)}</li>
          ))}
        </ListTag>
      );
    }
    case "table":
      return <MarkdownTable rows={block.rows} inverse={inverse} />;
    case "paragraph":
      return <p>{renderInlineMarkdown(block.content, inverse)}</p>;
  }
}

function MarkdownTable({ rows, inverse }: { rows: string[][]; inverse: boolean }) {
  const [header, ...body] = rows;

  return (
    <div
      className={cn(
        "my-3 overflow-x-auto rounded-xl border text-left",
        inverse ? "border-primary-foreground/25" : "border-border bg-background/80",
      )}
    >
      <table className="min-w-full border-collapse text-sm">
        <thead className={inverse ? "bg-primary-foreground/10" : "bg-secondary/70"}>
          <tr>
            {header.map((cell, index) => (
              <th key={`head-${index}`} className="px-3 py-2 font-semibold">
                {renderInlineMarkdown(cell, inverse)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, rowIndex) => (
            <tr key={`row-${rowIndex}`} className={inverse ? "" : "border-t border-border"}>
              {header.map((_, cellIndex) => (
                <td key={`cell-${rowIndex}-${cellIndex}`} className="px-3 py-2 align-top">
                  {renderInlineMarkdown(row[cellIndex] ?? "", inverse)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function isTableRow(line: string) {
  return line.startsWith("|") && line.includes("|", 1);
}

function splitTableRow(line: string) {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

function isTableSeparatorRow(cells: string[]) {
  return cells.length > 1 && cells.every((cell) => /^:?-{3,}:?$/.test(cell.replace(/\s/g, "")));
}

function renderInlineMarkdown(text: string, inverse: boolean) {
  const parts: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(
        <code
          key={`${match.index}-code`}
          className={cn(
            "rounded px-1.5 py-0.5 text-[0.85em]",
            inverse ? "bg-primary-foreground/15" : "bg-muted text-foreground",
          )}
        >
          {token.slice(1, -1)}
        </code>,
      );
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length ? parts : text;
}
