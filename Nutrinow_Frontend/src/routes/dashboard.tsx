import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import UserDashboard, {
  fallbackInsights,
  fallbackProfile,
  fallbackWeightHistory,
  type ConversationInsight,
  type UserProfile,
  type WeightHistoryPoint,
} from "@/components/UserDashboard";
import { apiRequest } from "@/lib/api";
import { CHAT_SESSION_STORAGE_KEY, useAuth } from "@/lib/auth";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
  head: () => ({
    meta: [
      { title: "Dashboard — NutriNow" },
      {
        name: "description",
        content: "Visualize peso, IMC, meta e insights da sua rotina no NutriNow.",
      },
    ],
  }),
});

interface DashboardResponse {
  success: boolean;
  profile: UserProfile;
  conversationInsights: ConversationInsight[];
  weightHistory: WeightHistoryPoint[];
}

function DashboardPage() {
  const { user, token, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!authLoading && (!user || !token)) {
      navigate({ to: "/login" });
    }
  }, [authLoading, user, token, navigate]);

  useEffect(() => {
    const loadDashboard = async () => {
      if (!token) return;

      setLoading(true);
      setError("");

      try {
        const sessionId =
          typeof window !== "undefined"
            ? localStorage.getItem(CHAT_SESSION_STORAGE_KEY) ?? undefined
            : undefined;

        const data = await apiRequest<DashboardResponse>("/dashboard", {
          method: "GET",
          token,
          sessionId,
        });

        setDashboard(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erro ao carregar dashboard");
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, [token]);

  if (!user && !authLoading) return null;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      {loading ? (
        <main className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-[2rem] border border-border bg-card p-10 text-center text-muted-foreground shadow-sm">
            Carregando dashboard...
          </div>
        </main>
      ) : error ? (
        <main className="mx-auto max-w-7xl px-6 py-12">
          <div className="rounded-[2rem] border border-destructive/20 bg-destructive/5 p-8 text-destructive shadow-sm">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 shrink-0" />
              <p className="font-medium">{error}</p>
            </div>
            <p className="mt-3 text-sm text-muted-foreground">
              Exibindo um dashboard demonstrativo enquanto a conexao com o backend nao responde como esperado.
            </p>
          </div>

          <div className="mt-6">
            <UserDashboard
              initialProfile={{
                ...fallbackProfile,
                name: user?.nome ?? fallbackProfile.name,
              }}
              initialInsights={fallbackInsights}
              initialWeightHistory={fallbackWeightHistory}
            />
          </div>
        </main>
      ) : (
        <UserDashboard
          initialProfile={dashboard?.profile ?? { ...fallbackProfile, name: user?.nome ?? fallbackProfile.name }}
          initialInsights={dashboard?.conversationInsights?.length ? dashboard.conversationInsights : fallbackInsights}
          initialWeightHistory={dashboard?.weightHistory?.length ? dashboard.weightHistory : fallbackWeightHistory}
        />
      )}
    </div>
  );
}
