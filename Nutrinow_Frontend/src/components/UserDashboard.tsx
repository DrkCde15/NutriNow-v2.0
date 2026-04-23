import { useMemo, useState, type ReactNode } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Dumbbell,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  ConversationInsight,
  UserProfile,
  WeightHistoryPoint,
} from "@/components/dashboard-models";

interface UserDashboardProps {
  initialProfile: UserProfile;
  initialInsights: ConversationInsight[];
  initialWeightHistory: WeightHistoryPoint[];
}

function getInsightIcon(status: ConversationInsight["status"]) {
  if (status === "positive") {
    return <CheckCircle2 className="h-4 w-4 text-primary" />;
  }

  if (status === "alert") {
    return <AlertTriangle className="h-4 w-4 text-destructive" />;
  }

  return <Activity className="h-4 w-4 text-accent-foreground" />;
}

function getInsightBadgeClass(status: ConversationInsight["status"]) {
  if (status === "positive") {
    return "border-primary/20 bg-primary/10 text-primary";
  }

  if (status === "alert") {
    return "border-destructive/20 bg-destructive/10 text-destructive";
  }

  return "border-accent/20 bg-accent/20 text-accent-foreground";
}

export default function UserDashboard({
  initialProfile,
  initialInsights,
  initialWeightHistory,
}: UserDashboardProps) {
  const [profile] = useState<UserProfile>(initialProfile);
  const [insights] = useState<ConversationInsight[]>(initialInsights);
  const [chartData] = useState<WeightHistoryPoint[]>(initialWeightHistory);

  const bmi = useMemo(() => {
    const calculateBmi = (height: number, weight: number) => {
      if (height <= 0 || weight <= 0) return 0;
      return weight / (height * height);
    };

    return calculateBmi(profile.height, profile.weight);
  }, [profile.height, profile.weight]);

  const latestInsight = insights[0]?.activity ?? "Sem novos insights por enquanto.";
  const hasChartData = useMemo(
    () => chartData.some((point) => point.activityLevel > 0 || typeof point.weight === "number"),
    [chartData],
  );

  const weightLabel = profile.weight > 0 ? `${profile.weight.toFixed(1)} kg` : "--";
  const heightLabel = profile.height > 0 ? `${profile.height.toFixed(2)} m` : "--";
  const bmiLabel = bmi > 0 ? bmi.toFixed(1) : "--";

  return (
    <section className="min-h-screen bg-background">
      <main className="mx-auto max-w-7xl px-6 py-10 md:px-8 md:py-12">
        <div className="rounded-[2rem] border border-border bg-card p-6 shadow-elegant md:p-8">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Visao geral
              </span>
              <h1 className="mt-4 font-display text-3xl font-bold tracking-tight md:text-4xl">
                Dashboard de {profile.name}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">
                Meta atual: <span className="font-semibold text-foreground">{profile.goal}</span>
              </p>
            </div>

            <div className="rounded-3xl border border-primary/20 bg-gradient-soft p-4 md:min-w-[320px]">
              <div className="flex items-start gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-hero text-primary-foreground shadow-glow">
                  <Target className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                    Ultimo insight
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-foreground">{latestInsight}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <MetricCard
                title="Peso"
                value={weightLabel}
                description="Peso atual registrado"
                icon={<Scale className="h-5 w-5 text-primary" />}
              />
              <MetricCard
                title="Altura"
                value={heightLabel}
                description="Altura salva no perfil"
                icon={<TrendingUp className="h-5 w-5 text-primary" />}
              />
              <MetricCard
                title="IMC"
                value={bmiLabel}
                description="Indice de massa corporal"
                icon={<Activity className="h-5 w-5 text-primary" />}
              />
            </div>

            <div className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-8">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="font-display text-2xl font-bold">Evolucao recente</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Acompanhamento visual do peso e do nivel de atividade ao longo dos ultimos dias.
                  </p>
                </div>
                <span className="inline-flex items-center gap-2 self-start rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                  <Dumbbell className="h-3.5 w-3.5" /> Foco em constancia
                </span>
              </div>

              <div className="mt-6 h-80 w-full">
                {hasChartData ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid stroke="var(--color-border)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="date"
                        stroke="var(--color-muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        stroke="var(--color-muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                        domain={["dataMin - 1", "dataMax + 1"]}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        stroke="var(--color-muted-foreground)"
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          borderRadius: 18,
                          border: "1px solid var(--color-border)",
                          backgroundColor: "white",
                          color: "var(--color-foreground)",
                        }}
                      />
                      <Line
                        yAxisId="left"
                        type="monotone"
                        dataKey="weight"
                        name="Peso"
                        stroke="var(--color-primary)"
                        strokeWidth={3}
                        dot={{ r: 4, fill: "var(--color-primary)" }}
                        activeDot={{ r: 6 }}
                        connectNulls={false}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="activityLevel"
                        name="Atividade"
                        stroke="var(--color-accent-foreground)"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "var(--color-accent-foreground)" }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center rounded-3xl border border-dashed border-border bg-muted/20 px-6 text-center text-sm text-muted-foreground">
                    Ainda nao ha historico suficiente no banco para montar o grafico.
                  </div>
                )}
              </div>
            </div>
          </div>

          <aside className="rounded-[2rem] border border-border bg-card p-6 shadow-sm md:p-8">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Timeline
              </span>
              <h2 className="mt-4 font-display text-2xl font-bold">Insights da conversa</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                Resumo automatico do que o sistema identificou nas conversas e na rotina recente.
              </p>
            </div>

            <ul className="mt-6 space-y-4">
              {insights.length ? (
                insights.map((item) => (
                  <li
                    key={`${item.date}-${item.activity}`}
                    className="rounded-3xl border border-border bg-gradient-soft p-4"
                  >
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-card shadow-sm">
                        {getInsightIcon(item.status)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                            {item.date}
                          </span>
                          <span
                            className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider ${getInsightBadgeClass(item.status)}`}
                          >
                            {item.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-relaxed text-foreground">
                          {item.activity}
                        </p>
                      </div>
                    </div>
                  </li>
                ))
              ) : (
                <li className="rounded-3xl border border-dashed border-border bg-muted/20 p-4 text-sm leading-relaxed text-muted-foreground">
                  Envie mensagens no chat ou registre dieta/treino para alimentar esta timeline.
                </li>
              )}
            </ul>
          </aside>
        </div>
      </main>
    </section>
  );
}

interface MetricCardProps {
  title: string;
  value: string;
  description: string;
  icon: ReactNode;
}

function MetricCard({ title, value, description, icon }: MetricCardProps) {
  return (
    <article className="rounded-3xl border border-border bg-card p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className="mt-3 font-display text-3xl font-bold tracking-tight text-foreground">
            {value}
          </p>
        </div>
        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          {icon}
        </span>
      </div>
      <p className="mt-4 text-sm text-muted-foreground">{description}</p>
    </article>
  );
}
