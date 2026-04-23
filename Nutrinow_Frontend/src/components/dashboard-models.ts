export interface UserProfile {
  name: string;
  height: number;
  weight: number;
  goal: string;
}

export interface ConversationInsight {
  date: string;
  activity: string;
  status: "positive" | "neutral" | "alert";
}

export interface WeightHistoryPoint {
  date: string;
  weight: number | null;
  activityLevel: number;
}

export const fallbackProfile: UserProfile = {
  name: "Usuario NutriNow",
  height: 0,
  weight: 0,
  goal: "Nao definida",
};
