import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Dumbbell, Salad } from "lucide-react";

export type CalendarItemType = "treino" | "dieta";

export interface CalendarItem {
  id: number | string;
  type: CalendarItemType;
  startsAt: string;
  title: string;
  description?: string;
}

interface LoadEventsParams {
  year: number;
  month: number;
}

interface TrainingDietCalendarProps {
  loadEvents: (params: LoadEventsParams) => Promise<CalendarItem[]>;
  initialDate?: Date;
}

const weekDays = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sab"];

function getMonthLabel(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function toLocalDateKey(value: string) {
  const date = new Date(value);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

export function TrainingDietCalendar({
  loadEvents,
  initialDate = new Date(),
}: TrainingDietCalendarProps) {
  const [currentDate, setCurrentDate] = useState(
    new Date(initialDate.getFullYear(), initialDate.getMonth(), 1),
  );
  const [events, setEvents] = useState<CalendarItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchEvents = async () => {
      setLoading(true);
      setError("");

      try {
        const data = await loadEvents({
          year: currentDate.getFullYear(),
          month: currentDate.getMonth() + 1,
        });
        setEvents(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar agenda do mês");
        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    void fetchEvents();
  }, [currentDate, loadEvents]);

  const daysInMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();

  const groupedEvents = useMemo(() => {
    return events.reduce<Record<string, CalendarItem[]>>((acc, item) => {
      const key = toLocalDateKey(item.startsAt);
      acc[key] ??= [];
      acc[key].push(item);
      return acc;
    }, {});
  }, [events]);

  const calendarCells = useMemo(() => {
    const cells: Array<{ key: string; dayNumber: number | null }> = [];

    for (let i = 0; i < firstDayOfWeek; i += 1) {
      cells.push({ key: `empty-start-${i}`, dayNumber: null });
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      cells.push({ key: `day-${day}`, dayNumber: day });
    }

    const remainingCells = (7 - (cells.length % 7)) % 7;

    for (let i = 0; i < remainingCells; i += 1) {
      cells.push({ key: `empty-end-${i}`, dayNumber: null });
    }

    return cells;
  }, [daysInMonth, firstDayOfWeek]);

  const goToPreviousMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  return (
    <section className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Agenda mensal
          </p>
          <h2 className="mt-2 text-2xl font-bold capitalize text-foreground md:text-3xl">
            {getMonthLabel(currentDate)}
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-smooth hover:border-primary/40 hover:bg-secondary"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground transition-smooth hover:border-primary/40 hover:bg-secondary"
            aria-label="Próximo mês"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-5 rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="mt-6 grid grid-cols-7 gap-2 text-center text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {weekDays.map((day) => (
          <div key={day} className="rounded-2xl bg-secondary/60 px-2 py-3">
            {day}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-7 gap-2">
        {calendarCells.map((cell) => {
          if (!cell.dayNumber) {
            return (
              <div
                key={cell.key}
                className="min-h-[140px] rounded-2xl border border-dashed border-border/70 bg-background/40"
              />
            );
          }

          const dateKey = `${currentDate.getFullYear()}-${`${currentDate.getMonth() + 1}`.padStart(2, "0")}-${`${cell.dayNumber}`.padStart(2, "0")}`;
          const dayEvents = groupedEvents[dateKey] ?? [];

          return (
            <div
              key={cell.key}
              className="min-h-[140px] rounded-2xl border border-border bg-background p-2.5 shadow-sm"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-sm font-bold text-foreground">
                  {cell.dayNumber}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">
                  {dayEvents.length} item{dayEvents.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="space-y-2">
                {loading ? (
                  <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
                    Carregando...
                  </div>
                ) : dayEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border px-3 py-2 text-xs text-muted-foreground">
                    Sem agenda
                  </div>
                ) : (
                  dayEvents.map((item) => {
                    const isWorkout = item.type === "treino";

                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border px-3 py-2 text-left text-xs shadow-sm ${
                          isWorkout
                            ? "border-sky-200 bg-sky-50 text-sky-950"
                            : "border-emerald-200 bg-emerald-50 text-emerald-950"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex h-6 w-6 items-center justify-center rounded-full ${
                              isWorkout
                                ? "bg-sky-100 text-sky-700"
                                : "bg-emerald-100 text-emerald-700"
                            }`}
                          >
                            {isWorkout ? (
                              <Dumbbell className="h-3.5 w-3.5" />
                            ) : (
                              <Salad className="h-3.5 w-3.5" />
                            )}
                          </span>
                          <div className="min-w-0">
                            <p className="font-semibold">{item.title}</p>
                            <p className="text-[11px] opacity-75">
                              {isWorkout ? "Treino" : "Dieta"} • {getTimeLabel(item.startsAt)}
                            </p>
                          </div>
                        </div>

                        {item.description && (
                          <p className="mt-2 text-[11px] opacity-80">{item.description}</p>
                        )}
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
