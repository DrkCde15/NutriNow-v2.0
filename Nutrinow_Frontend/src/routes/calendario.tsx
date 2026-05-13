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
  duration_minutes?: number | null;
  recurrence_type?: "none" | "weekly" | null;
  recurrence_days?: string | null;
  recurrence_until?: string | null;
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
      { title: "Calendario - NutriNow" },
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

function getTimeInputValue(date = new Date()) {
  const hours = `${date.getHours()}`.padStart(2, "0");
  const minutes = `${date.getMinutes()}`.padStart(2, "0");
  return `${hours}:${minutes}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

const weekDayOptions = [
  { code: "MO", label: "Seg" },
  { code: "TU", label: "Ter" },
  { code: "WE", label: "Qua" },
  { code: "TH", label: "Qui" },
  { code: "FR", label: "Sex" },
  { code: "SA", label: "Sab" },
  { code: "SU", label: "Dom" },
] as const;

type GoogleDayCode = (typeof weekDayOptions)[number]["code"];

const jsDayToGoogleDay: GoogleDayCode[] = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

function getGoogleDayCode(date = new Date()) {
  return jsDayToGoogleDay[date.getDay()];
}

function parseDateOnly(value: string) {
  const isoDate = value.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) {
    const [year, month, day] = isoDate.split("-").map(Number);
    return new Date(year, month - 1, day);
  }
  return new Date(value);
}

function startOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function endOfDay(date: Date) {
  const next = new Date(date);
  next.setHours(23, 59, 59, 999);
  return next;
}

function expandPlanItem(item: ApiPlanItem, params: { year: number; month: number }): CalendarItem[] {
  const baseStart = new Date(toStartsAt(item.created_at, item.time));
  const baseItem = {
    planId: item.id,
    type: item.tipo,
    title: item.title,
    description: item.description,
    time: item.time ?? null,
    scheduleDate: toDateInputValue(baseStart),
    durationMinutes: item.duration_minutes ?? 60,
    recurrenceType: item.recurrence_type ?? "none",
    recurrenceDays: item.recurrence_days ?? null,
    recurrenceUntil: item.recurrence_until ?? null,
  };

  if (item.recurrence_type !== "weekly" || !item.recurrence_days) {
    return [
      {
        id: `${item.tipo}-${item.id}`,
        startsAt: baseStart.toISOString(),
        ...baseItem,
      },
    ];
  }

  const recurrenceDays = new Set(item.recurrence_days.split(",").map((day) => day.trim()));
  const monthStart = startOfDay(new Date(params.year, params.month - 1, 1));
  const monthEnd = endOfDay(new Date(params.year, params.month, 0));
  const seriesStart = startOfDay(baseStart);
  const seriesEnd = item.recurrence_until ? endOfDay(parseDateOnly(item.recurrence_until)) : monthEnd;
  const firstDay = monthStart > seriesStart ? monthStart : seriesStart;
  const occurrences: CalendarItem[] = [];

  for (let cursor = new Date(firstDay); cursor <= monthEnd && cursor <= seriesEnd; cursor = addDays(cursor, 1)) {
    if (!recurrenceDays.has(getGoogleDayCode(cursor))) continue;

    const startsAt = new Date(cursor);
    startsAt.setHours(baseStart.getHours(), baseStart.getMinutes(), 0, 0);
    occurrences.push({
      id: `${item.tipo}-${item.id}-${toDateInputValue(startsAt)}`,
      startsAt: startsAt.toISOString(),
      isRecurring: true,
      ...baseItem,
    });
  }

  return occurrences;
}

function CalendarioPage() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [googleStatus, setGoogleStatus] = useState<GoogleCalendarStatus>({ connected: false });
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleAction, setGoogleAction] = useState<"connect" | "sync" | "disconnect" | null>(null);
  const [googleMessage, setGoogleMessage] = useState("");
  const [googleError, setGoogleError] = useState("");
  const [calendarRefresh, setCalendarRefresh] = useState(0);
  const [itemModalOpen, setItemModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CalendarItem | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [deletingItemId, setDeletingItemId] = useState<number | null>(null);
  const [itemError, setItemError] = useState("");
  const [itemForm, setItemForm] = useState<{
    tipo: ApiPlanType;
    title: string;
    description: string;
    date: string;
    time: string;
    durationHours: string;
    recurrenceType: "none" | "weekly";
    recurrenceDays: GoogleDayCode[];
    recurrenceUntil: string;
  }>({
    tipo: "treino" as ApiPlanType,
    title: "",
    description: "",
    date: toDateInputValue(),
    time: "08:00",
    durationHours: "2",
    recurrenceType: "none" as "none" | "weekly",
    recurrenceDays: [getGoogleDayCode()],
    recurrenceUntil: toDateInputValue(addDays(new Date(), 84)),
  });

  useEffect(() => {
    if (authLoading) return;
    if (!user || !token) navigate({ to: "/login", replace: true });
  }, [authLoading, user, token, navigate]);

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
    setEditingItem(null);
    setItemForm({
      tipo: "treino",
      title: "",
      description: "",
      date: toDateInputValue(),
      time: "08:00",
      durationHours: "2",
      recurrenceType: "none",
      recurrenceDays: [getGoogleDayCode()],
      recurrenceUntil: toDateInputValue(addDays(new Date(), 84)),
    });
    setItemModalOpen(true);
  };

  const openEditItemModal = (item: CalendarItem) => {
    const durationHours = item.durationMinutes ? `${item.durationMinutes / 60}` : "1";
    const recurrenceDays = (item.recurrenceDays ?? "")
      .split(",")
      .map((day) => day.trim())
      .filter((day): day is GoogleDayCode => weekDayOptions.some((option) => option.code === day));

    setItemError("");
    setEditingItem(item);
    setItemForm({
      tipo: item.type,
      title: item.title,
      description: item.description ?? "",
      date: item.scheduleDate ?? toDateInputValue(new Date(item.startsAt)),
      time: item.time ?? getTimeInputValue(new Date(item.startsAt)),
      durationHours,
      recurrenceType: item.recurrenceType === "weekly" ? "weekly" : "none",
      recurrenceDays: recurrenceDays.length > 0 ? recurrenceDays : [getGoogleDayCode(new Date(item.startsAt))],
      recurrenceUntil: item.recurrenceUntil ?? toDateInputValue(addDays(new Date(item.startsAt), 84)),
    });
    setItemModalOpen(true);
  };

  const saveCalendarItem = async (event: FormEvent) => {
    event.preventDefault();
    if (!token) return;

    setItemError("");
    setGoogleMessage("");
    setGoogleError("");

    const durationHours = Number(itemForm.durationHours);
    if (!Number.isFinite(durationHours) || durationHours < 0.25 || durationHours > 12) {
      setItemError("Informe uma duracao entre 15 minutos e 12 horas.");
      return;
    }

    setItemSaving(true);

    try {
      const durationMinutes = Math.round(durationHours * 60);
      const isEditing = Boolean(editingItem?.planId);
      const result = await apiRequest<SavePlanResponse>(
        isEditing ? `/dieta-treino/${editingItem?.planId}` : "/dieta-treino",
        {
          method: isEditing ? "PUT" : "POST",
          token,
          body: JSON.stringify({
            tipo: itemForm.tipo,
            title: itemForm.title.trim(),
            description: itemForm.description.trim(),
            date: itemForm.date,
            time: itemForm.time || null,
            durationMinutes,
            recurrenceType: itemForm.recurrenceType,
            recurrenceDays: itemForm.recurrenceType === "weekly" ? itemForm.recurrenceDays : [],
            recurrenceUntil: itemForm.recurrenceType === "weekly" ? itemForm.recurrenceUntil : null,
          }),
        },
      );

      setItemModalOpen(false);
      setEditingItem(null);
      setCalendarRefresh((value) => value + 1);

      if (result.googleCalendar?.synced) {
        setGoogleMessage(isEditing ? "Item atualizado e sincronizado com Google Calendar." : "Item criado e sincronizado com Google Calendar.");
      } else if (googleStatus.connected) {
        setGoogleError(result.googleCalendar?.error || "Item salvo, mas o Google Calendar nao sincronizou.");
      } else {
        setGoogleMessage(isEditing ? "Item atualizado no calendario do NutriNow." : "Item criado no calendario do NutriNow.");
      }
    } catch (err) {
      setItemError(err instanceof Error ? err.message : "Erro ao salvar item");
    } finally {
      setItemSaving(false);
    }
  };

  const deleteCalendarItem = async (item: CalendarItem) => {
    if (!token || !item.planId) return;
    const message = item.isRecurring
      ? "Excluir esta serie semanal?"
      : "Excluir este item?";
    if (!confirm(message)) return;

    setDeletingItemId(item.planId);
    setGoogleMessage("");
    setGoogleError("");

    try {
      const result = await apiRequest<SavePlanResponse>(`/dieta-treino/${item.planId}`, {
        method: "DELETE",
        token,
      });
      setCalendarRefresh((value) => value + 1);

      if (googleStatus.connected && result.googleCalendar?.error) {
        setGoogleError(result.googleCalendar.error);
      } else {
        setGoogleMessage("Item excluido do calendario.");
      }
    } catch (err) {
      setGoogleError(err instanceof Error ? err.message : "Erro ao excluir item");
    } finally {
      setDeletingItemId(null);
    }
  };

  const toggleRecurrenceDay = (day: GoogleDayCode) => {
    setItemForm((current) => {
      const selected = current.recurrenceDays.includes(day)
        ? current.recurrenceDays.filter((item) => item !== day)
        : [...current.recurrenceDays, day];

      return {
        ...current,
        recurrenceDays: selected.length > 0 ? selected : current.recurrenceDays,
      };
    });
  };

  const loadEvents = useCallback(async (params: { year: number; month: number }): Promise<CalendarItem[]> => {
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

    return [...(treinos.items ?? []), ...(dietas.items ?? [])].flatMap((item) =>
      expandPlanItem(item, params),
    );
  }, [token, calendarRefresh]);

  const canSync = googleStatus.connected && !googleStatus.needsReconnect && googleAction === null;

  if (authLoading || !user || !token) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="font-display text-3xl font-bold md:text-4xl">
              Calendario para treinos e dietas
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
                    Forçar sincronização
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

        <TrainingDietCalendar
          loadEvents={loadEvents}
          onEditItem={openEditItemModal}
          onDeleteItem={deleteCalendarItem}
          busyItemId={deletingItemId}
        />
      </main>

      {itemModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4 backdrop-blur-sm sm:items-center"
          onClick={() => setItemModalOpen(false)}
        >
          <div
            className="max-h-[calc(100vh-2rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-card p-6 shadow-elegant sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-foreground">
                  {editingItem ? "Editar item" : "Adicionar item"}
                </h2>
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

            <form onSubmit={saveCalendarItem} className="mt-5 space-y-4">
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

              <div className="grid gap-3 sm:grid-cols-3">
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

                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium">Duracao (h)</span>
                  <input
                    type="number"
                    min="0.25"
                    max="12"
                    step="0.25"
                    value={itemForm.durationHours}
                    onChange={(event) => setItemForm((current) => ({ ...current, durationHours: event.target.value }))}
                    required
                    className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  />
                </label>
              </div>

              <div className="space-y-3 rounded-xl border border-border bg-background p-3">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setItemForm((current) => ({ ...current, recurrenceType: "none" }))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-smooth ${
                      itemForm.recurrenceType === "none"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Unico
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemForm((current) => ({ ...current, recurrenceType: "weekly" }))}
                    className={`rounded-lg px-3 py-2 text-sm font-semibold transition-smooth ${
                      itemForm.recurrenceType === "weekly"
                        ? "bg-foreground text-background"
                        : "bg-secondary text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Semanal
                  </button>
                </div>

                {itemForm.recurrenceType === "weekly" && (
                  <>
                    <div className="grid grid-cols-7 gap-1">
                      {weekDayOptions.map((day) => {
                        const selected = itemForm.recurrenceDays.includes(day.code);
                        return (
                          <button
                            key={day.code}
                            type="button"
                            onClick={() => toggleRecurrenceDay(day.code)}
                            className={`rounded-lg px-2 py-2 text-xs font-semibold transition-smooth ${
                              selected
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:text-foreground"
                            }`}
                          >
                            {day.label}
                          </button>
                        );
                      })}
                    </div>

                    <label className="block">
                      <span className="mb-1.5 block text-sm font-medium">Ate</span>
                      <input
                        type="date"
                        value={itemForm.recurrenceUntil}
                        onChange={(event) => setItemForm((current) => ({ ...current, recurrenceUntil: event.target.value }))}
                        required
                        className="w-full rounded-xl border border-input bg-card px-4 py-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                      />
                    </label>
                  </>
                )}
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
                  {itemSaving ? "Salvando..." : editingItem ? "Salvar" : "Adicionar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
