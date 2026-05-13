import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CalendarCheck, CheckCircle2, Link2, Plus, RefreshCw, Unlink, X } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { TrainingDietCalendar, type CalendarItem } from "@/components/training-diet-calendar";
import { apiRequest } from "@/lib/api";
import { useAuth } from "@/lib/auth";

type ApiPlanType = "treino" | "dieta";

interface ApiPlanItem {
  id: number;
  tipo: ApiPlanType;
  title: string;
  description: string;
  time?: string | null;
  created_at?: string;
}

interface GoogleCalendarStatus {
  connected: boolean;
  calendarId?: string;
  expiresAt?: string;
  needsReconnect?: boolean;
}

interface GoogleCalendarSyncResponse {
  success: boolean;
  calendarId: string;
  total: number;
  created: number;
  updated: number;
  failed: Array<{ id: number; tipo: ApiPlanType; error: string }>;
}

interface SavePlanResponse {
  success: boolean;
  message: string;
  googleCalendar?: {
    synced?: boolean;
    reason?: string;
    error?: string;
  };
}

export const Route = createFileRoute("/calendario")({
  component: CalendarioPage,
  head: () => ({
    meta: [
      { title: "Calendario — NutriNow" },
      {
        name: "description",
        content: "Visualize treinos e dietas em um calendario mensal.",
      },
    ],
  }),
});

function toStartsAt(createdAt: string | undefined, time: string | null | undefined) {
  const fallbackBase = createdAt ? new Date(createdAt) : new Date();

  if (time && /^\d{2}:\d{2}$/.test(time)) {
    const [hours, minutes] = time.split(":").map(Number);
    const merged = new Date(fallbackBase);
    merged.setHours(hours, minutes, 0, 0);
    return merged.toISOString();
  }

  return fallbackBase.toISOString();
}

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function CalendarioPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleAction, setGoogleAction] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemError, setItemError] = useState("");
  const [itemForm, setItemForm] = useState({
    tipo: "treino" as ApiPlanType,
    title: "",
    description: "",
    date: toDateInputValue(),
    time: "08:00",
  });

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  const loadGoogleStatus = useCallback(async () => {
    if (!token) return;
    setGoogleLoading(true);

    try {
      const status = await apiRequest<GoogleCalendarStatus>("/calendar/google/status", {
        method: "GET",
        token,
      });
      setGoogleStatus(status);
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Erro ao verificar Google Calendar");
    } finally {
      setGoogleLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadGoogleStatus();
  }, [loadGoogleStatus]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_calendar");
    if (!result) return;

    if (result === "connected") {
      setGoogleMessage("Google Calendar conectado.");
      setGoogleError("");
    } else if (result === "denied") {
      setGoogleError("Permissao do Google Calendar negada.");
      setGoogleMessage("");
    } else {
      setGoogleError("Nao foi possivel conectar o Google Calendar.");
      setGoogleMessage("");
    }

    params.delete("google_calendar");
    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}${window.location.hash}`;
    window.history.replaceState({}, document.title, nextUrl);
  }, []);

  const connectGoogleCalendar = async () => {
    setGoogleAction("connect");
    setGoogleError("");
    setGoogleMessage("");

    try {
      const { auth_url } = await apiRequest<{ auth_url: string }>("/calendar/google/connect", {
        method: "GET",
        token,
      });
      if (auth_url) window.location.href = auth_url;
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Erro ao conectar Google Calendar");
      setGoogleAction(null);
    }
  };

  const syncGoogleCalendar = async () => {
    setGoogleAction("sync");
    setGoogleError("");
    setGoogleMessage("");

    try {
      const result = await apiRequest<GoogleCalendarSyncResponse>("/calendar/google/sync", {
        method: "POST",
        token,
        body: JSON.stringify({}),
      });

      const baseMessage =
        result.total === 0
          ? "Nenhum item local para sincronizar."
          : `Sincronizacao concluida: ${result.created} criado(s), ${result.updated} atualizado(s).`;

      if (result.failed.length > 0) {
        setGoogleError(`${baseMessage} ${result.failed.length} item(ns) falharam.`);
      } else {
        setGoogleMessage(baseMessage);
      }

      await loadGoogleStatus();
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Erro ao sincronizar Google Calendar");
    } finally {
      setGoogleAction(null);
    }
  };

  const disconnectGoogleCalendar = async () => {
    if (!confirm("Desconectar Google Calendar?")) return;
    setGoogleAction("disconnect");
    setGoogleError("");
    setGoogleMessage("");

    try {
      await apiRequest("/calendar/google/disconnect", {
        method: "DELETE",
        token,
      });
      setGoogleStatus({ connected: false });
      setGoogleMessage("Google Calendar desconectado.");
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Erro ao desconectar Google Calendar");
    } finally {
      setGoogleAction(null);
    }
  };

  const openNewItemModal = () => {
    setItemError("");
    setItemForm({
      tipo: "treino",
      title: "",
      description: "",
      date: toDateInputValue(),
      time: "08:00",
    });
    setItemModalOpen(true);
  };

  const createCalendarItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    setItemSaving(true);
    setItemError("");
    setGoogleMessage("");
    setGoogleError("");

    try {
      const result = await apiRequest<SavePlanResponse>("/dieta-treino", {
        method: "POST",
        token,
        body: JSON.stringify({
          tipo: itemForm.tipo,
          title: itemForm.title.trim(),
          description: itemForm.description.trim(),
          date: itemForm.date,
          time: itemForm.time || null,
        }),
      });

      setItemModalOpen(false);
      setCalendarRefresh((value) => value + 1);

      if (result.googleCalendar?.synced) {
        setGoogleMessage("Item criado e sincronizado com Google Calendar.");
      } else if (googleStatus.connected) {
        setGoogleError(result.googleCalendar?.error || "Item criado, mas o Google Calendar nao sincronizou.");
      } else {
        setGoogleMessage("Item criado no calendario do NutriNow.");
      }
    } catch (err) {
      setItemError(err instanceof Error ? err.message : "Erro ao criar item");
    } finally {
      setItemSaving(false);
    }
  };

  const loadEvents = useCallback(async (): Promise<CalendarItem[]> => {
    if (!token) return [];
    void calendarRefresh;

    const [treinos, dietas] = await Promise.all([
      apiRequest<{ success: boolean; items: ApiPlanItem[] }>("/dieta-treino?tipo=treino", {
        method: "GET",
        token,
      }),
      apiRequest<{ success: boolean; items: ApiPlanItem[] }>("/dieta-treino?tipo=dieta", {
        method: "GET",
        token,
      }),
    ]);

    return [...(treinos.items ?? []), ...(dietas.items ?? [])].map((item) => ({
      id: `${item.tipo}-${item.id}`,
      type: item.tipo,
      startsAt: toStartsAt(item.created_at, item.time),
      title: item.title,
      description: item.description,
    }));
  }, [token, calendarRefresh]);

  const canSync = googleStatus.connected && !googleStatus.needsReconnect && googleAction === null;

  if (!user || !token) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Calendario de treinos e dietas
            </h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">
              Veja sua agenda do mes em um unico lugar. Os eventos sao carregados da sua base atual de
              planos.
            </p>
          </div>

          <button
            type="button"
            onClick={openNewItemModal}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-smooth hover:opacity-90 md:self-auto"
          >
            <Plus className="h-4 w-4" />
            Adicionar item
          </button>
        </div>

        <section className="mb-8 rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-secondary text-foreground">
                <CalendarCheck className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-base font-semibold text-foreground">Google Calendar</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {googleLoading
                    ? "Verificando conexao..."
                    : googleStatus.connected
                      ? googleStatus.needsReconnect
                        ? "Reconexao necessaria"
                        : `Conectado em ${googleStatus.calendarId ?? "primary"}`
                      : "Nao conectado"}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!googleStatus.connected || googleStatus.needsReconnect ? (
                <button
                  type="button"
                  onClick={connectGoogleCalendar}
                  disabled={googleAction !== null}
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground px-4 py-2.5 text-sm font-semibold text-background transition-smooth hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {googleAction === "connect" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Link2 className="h-4 w-4" />
                  )}
                  Conectar
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={syncGoogleCalendar}
                    disabled={!canSync}
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-hero px-4 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-smooth hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <RefreshCw className={`h-4 w-4 ${googleAction === "sync" ? "animate-spin" : ""}`} />
                    Sincronizar
                  </button>
                  <button
                    type="button"
                    onClick={disconnectGoogleCalendar}
                    disabled={googleAction !== null}
                    className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-foreground transition-smooth hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Unlink className="h-4 w-4" />
                    Desconectar
                  </button>
                </>
              )}
            </div>
          </div>

          {(googleMessage || googleError) && (
            <div
              className={`mt-4 flex items-start gap-2 rounded-xl border px-3 py-2 text-sm ${
                googleError
                  ? "border-destructive/20 bg-destructive/5 text-destructive"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800"
              }`}
            >
              {googleError ? (
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              ) : (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              )}
              <span>{googleError || googleMessage}</span>
            </div>
          )}
        </section>

        <TrainingDietCalendar loadEvents={loadEvents} />
      </main>

      {itemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 p-4 backdrop-blur-sm"
          onClick={() => setItemModalOpen(false)}
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-card p-6 shadow-elegant sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">Adicionar item</h2>
              </div>
              <button
                type="button"
                onClick={() => setItemModalOpen(false)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {itemError && (
              <div className="mt-4 rounded-xl border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                {itemError}
              </div>
            )}

            <form onSubmit={createCalendarItem} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setItemForm((current) => ({ ...current, tipo: "treino" }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-smooth ${
                    itemForm.tipo === "treino"
                      ? "border-sky-300 bg-sky-50 text-sky-900"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Treino
                </button>
                <button
                  type="button"
                  onClick={() => setItemForm((current) => ({ ...current, tipo: "dieta" }))}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-smooth ${
                    itemForm.tipo === "dieta"
                      ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  Dieta
                </button>
              </div>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Titulo</span>
                <input
                  type="text"
                  value={itemForm.title}
                  onChange={(event) => setItemForm((current) => ({ ...current, title: event.target.value }))}
                  required
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder={itemForm.tipo === "treino" ? "Ex: Treino de pernas" : "Ex: Almoco"}
                />
              </label>

              <label className="block">
                <span className="mb-1.5 block text-sm font-medium">Descricao</span>
                <textarea
                  value={itemForm.description}
                  onChange={(event) => setItemForm((current) => ({ ...current, description: event.target.value }))}
                  required
                  rows={4}
                  className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  placeholder="Detalhes..."
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Data</span>
                  <input
                    type="date"
                    value={itemForm.date}
                    onChange={(event) => setItemForm((current) => ({ ...current, date: event.target.value }))}
                    required
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Horario</span>
                  <input
                    type="time"
                    value={itemForm.time}
                    onChange={(event) => setItemForm((current) => ({ ...current, time: event.target.value }))}
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setItemModalOpen(false)}
                  className="flex-1 rounded-xl border border-border bg-card px-5 py-3 text-sm font-semibold text-foreground transition-smooth hover:bg-secondary"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={itemSaving}
                  className="flex-1 rounded-xl bg-gradient-hero px-5 py-3 text-sm font-semibold text-primary-foreground shadow-elegant transition-smooth hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {itemSaving ? "Salvando..." : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
