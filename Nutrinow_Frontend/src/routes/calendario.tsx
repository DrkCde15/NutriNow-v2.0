import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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

function CalendarioPage() {
  const { user, token } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!user || !token) navigate({ to: "/login" });
  }, [user, token, navigate]);

  if (!user || !token) return null;

  const loadEvents = async (): Promise<CalendarItem[]> => {
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
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <main className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-8">
          <h1 className="font-display text-3xl font-bold md:text-4xl">
            Calendario de treinos e dietas
          </h1>
          <p className="mt-2 max-w-2xl text-muted-foreground">
            Veja sua agenda do mes em um unico lugar. Os eventos sao carregados da sua base atual de
            planos.
          </p>
        </div>

        <TrainingDietCalendar loadEvents={loadEvents} />
      </main>
    </div>
  );
}
